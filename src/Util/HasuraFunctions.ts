import { Connection } from "typeorm";
import { IAction } from "./Action";
import {
  ICustomEnumType,
  ICustomInputType,
  ICustomObjectType,
} from "./CustomTypes";
import { IEventHook } from "./EventHook";
import { IRemoteSchema } from "./RemoteSchema";
import fetch from "node-fetch";
import { IHasuraConfig } from "../Config";
import { URL } from "url";
import { IComputedField } from "./ComputedField";
import { IPerm, InsertPerm, DeletePerm, SelectPerm, UpdatePerm } from "./Perm";

export class HasuraFunctions {
  static conf: IHasuraConfig;

  static Configure(conf: IHasuraConfig) {
    this.conf = conf;
  }

  static async fetchHasura(url: string, body: any) {
    const result = await fetch(new URL(url, this.conf.hasura.url).href, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": this.conf.hasura.adminSecret,
      },
    }).then((res: any) => res.json());
    if (
      result.message !== "success" &&
      result.code !== "already-tracked" &&
      !(body.type?.includes("drop") && body.type?.includes("permission"))
    ) {
      console.log("\n\n", body, result, "\n\n");
    }
    return result;
  }

  static async reloadHasura() {
    await this.fetchHasura("/v1/query", {
      type: "reload_metadata",
      args: {
        reload_remote_schemas: true,
      },
    });
  }

  static async trackTable(table: string) {
    await this.fetchHasura("/v1/query", {
      type: "track_table",
      args: {
        schema: "public",
        name: table,
      },
    });
  }

  static async trackCustomFunction(name: string, session_argument?: string) {
    const conf: any = {};
    if (session_argument) {
      conf.session_argument = session_argument;
    }
    await this.fetchHasura("/v1/query", {
      type: "track_function",
      version: 2,
      args: {
        function: {
          schema: "public",
          name: name,
        },
        configuration: conf,
      },
    });
  }

  static async registerEventHook(hook: IEventHook, conn?: Connection) {
    let name: string;
    if (typeof hook.entity === "string") {
      name = hook.entity;
    } else {
      const meta = conn!.getMetadata(hook.entity);
      name = meta.tableName;
    }

    let url = hook.url;

    if (!url) {
      url = new URL(`/hook/${hook.name}`, this.conf.webhook.url).href;
    }

    await this.fetchHasura("/v1/query", {
      type: "create_event_trigger",
      args: {
        name: hook.name,
        table: {
          name: name,
          schema: "public",
        },
        webhook: url,
        insert: hook.insertConf,
        update: hook.updateConf,
        delete: hook.deleteConf,
        replace: false,
      },
    });
  }

  static async addRemoteSchema(schema: IRemoteSchema) {
    await this.fetchHasura("/v1/query", {
      type: "add_remote_schema",
      args: {
        name: schema.name,
        definition: {
          url: schema.url,
          forward_client_headers: true,
          timeout_seconds: schema.timeout_seconds || 60,
        },
      },
    });
  }

  static async registerCustomType(
    type: ICustomInputType | ICustomObjectType | ICustomEnumType,
  ) {
    let args = {};
    if (type.type === "InputType") {
      args = {
        input_objects: [
          {
            name: type.name,
            description: type.description,
            fields: type.fields,
          },
        ],
      };
    } else if (type.type === "ObjectType") {
      args = {
        objects: [
          {
            name: type.name,
            description: type.description,
            fields: type.fields,
            relationships: type.relationships || [],
          },
        ],
      };
    } else if (type.type === "EnumType") {
      args = {
        enums: [
          {
            name: type.name,
            description: type.description,
            values: type.values,
          },
        ],
      };
    }

    await this.fetchHasura("/v1/query", {
      type: "set_custom_types",
      args,
    });
  }

  static async registerAction(action: IAction) {
    let url = action.url;

    if (!url) {
      url = new URL(`/action/${action.name}`, this.conf.webhook.url).href;
    }

    await this.fetchHasura("/v1/query", {
      type: "create_action",
      args: {
        name: action.name,
        definition: {
          kind: action.kind,
          arguments: action.args,
          output_type: action.output_type,
          handler: url,
          timeout: action.timeout_seconds || 60,
        },
      },
      comment: action.description,
    });

    for (const u of action.users) {
      await this.fetchHasura("/v1/query", {
        type: "create_action_permission",
        args: {
          action: action.name,
          role: u,
        },
      });
    }
  }

  static async registerComputedField(field: IComputedField, conn: Connection) {
    const table =
      typeof field.entity === "string"
        ? field.entity
        : conn.getMetadata(field.entity).tableName;
    return await this.fetchHasura("/v1/query", {
      type: "add_computed_field",
      args: {
        table: {
          name: table,
          schema: "public",
        },
        name: this.name,
        definition: {
          function: {
            name: field.function_name,
            schema: "public",
          },
          table_argument: field.table_argument,
          session_argument: field.session_argument,
        },
      },
    });
  }

  static async syncRelations(conn: Connection) {
    for (const e of this.conf.entities) {
      const metadata = conn.getMetadata(e);
      const rels = metadata.ownRelations;

      for (const rel of rels) {
        const type = rel.relationType;
        if (type === "many-to-one") {
          const relName = rel.propertyName;
          const tableName = metadata.tableName;
          const fkCol = rel.joinColumns.find(
            (c) => c.propertyName === rel.propertyName,
          )!.givenDatabaseName;

          await this.fetchHasura("/v1/query", {
            type: "create_object_relationship",
            args: {
              table: tableName,
              name: relName,
              using: {
                foreign_key_constraint_on: fkCol,
              },
            },
          });
        } else if (type === "many-to-many") {
          if (rel.joinTableName) {
            await this.trackTable(rel.joinTableName);
          }

          const relName = rel.propertyName;
          const tableName = metadata.tableName;
          const fks = rel.isManyToManyOwner
            ? rel.foreignKeys
            : rel.inverseRelation!.foreignKeys;

          // table => joinTable one-to-many
          // joinTable => table many-to-one

          const fk = fks.find(
            (fk) => fk.referencedEntityMetadata.tableName === tableName,
          )!;
          // one-to-many
          const fkTableOneToMany = fk.entityMetadata.tableName;
          const fkColOneToMany = fk.columnNames[0]; //TODO: is there a better way

          await this.fetchHasura("/v1/query", {
            type: "create_array_relationship",
            args: {
              table: tableName,
              name: relName,
              using: {
                foreign_key_constraint_on: {
                  table: fkTableOneToMany,
                  column: fkColOneToMany,
                },
              },
            },
          });

          //many-to-one
          await this.fetchHasura("/v1/query", {
            type: "create_object_relationship",
            args: {
              table: fkTableOneToMany,
              name: fkColOneToMany.substr(0, fkColOneToMany.length - 2), //TODO: find a better way
              using: {
                foreign_key_constraint_on: fkColOneToMany,
              },
            },
          });
        } else if (type === "one-to-many") {
          const relName = rel.propertyName;
          const tableName = metadata.tableName;
          const fkTable = rel.inverseEntityMetadata.tableName;
          const fkCol = rel.inverseRelation!.joinColumns.find(
            (c) => c.propertyName === rel.inverseRelation!.propertyName,
          )!.givenDatabaseName;

          await this.fetchHasura("/v1/query", {
            type: "create_array_relationship",
            args: {
              table: tableName,
              name: relName,
              using: {
                foreign_key_constraint_on: {
                  table: fkTable,
                  column: fkCol,
                },
              },
            },
          });
        } else if (type === "one-to-one") {
          const relName = rel.propertyName;
          const tableName = metadata.tableName;

          const joinCols = rel.isOneToOneOwner
            ? rel.joinColumns
            : rel.inverseRelation!.joinColumns;
          const fkCol = joinCols[0];

          if (rel.isOneToOneOwner) {
            await this.fetchHasura("/v1/query", {
              type: "create_object_relationship",
              args: {
                table: tableName,
                name: relName,
                using: {
                  foreign_key_constraint_on: fkCol.givenDatabaseName!,
                },
              },
            });
          } else {
            await this.fetchHasura("/v1/query", {
              type: "create_object_relationship",
              args: {
                table: tableName,
                name: relName,
                using: {
                  manual_configuration: {
                    remote_table: rel.inverseEntityMetadata.tableName,
                    column_mapping: {
                      [fkCol.referencedColumn!
                        .databaseName]: fkCol.givenDatabaseName!,
                    },
                  },
                },
              },
            });
          }
        }
      }
    }
  }

  static async permDropAll(perm: IPerm, conn: Connection) {
    let table =
      typeof perm.entity === "string"
        ? perm.entity
        : conn.getMetadata(perm.entity).tableName;

    for (const op of ["insert", "select", "update", "delete"]) {
      await this.fetchHasura("/v1/query", {
        type: `drop_${op}_permission`,
        args: {
          table,
          role: perm.role,
        },
      });
    }
  }

  static async permApplyTo(perm: IPerm, conn: Connection) {
    let table =
      typeof perm.entity === "string"
        ? perm.entity
        : conn.getMetadata(perm.entity).tableName;

    const rb = (
      create: boolean,
      type: "insert" | "select" | "update" | "delete",
      permission: InsertPerm | SelectPerm | UpdatePerm | DeletePerm | null,
    ) => {
      const args = { table, role: perm.role };
      if (create) {
        (args as any).permission = permission;
      }
      return this.fetchHasura("/v1/query", {
        type: `${create ? "create" : "drop"}_${type}_permission`,
        args,
      });
    };

    await rb(!!perm.insertPerm, "insert", perm.insertPerm);
    await rb(!!perm.selectPerm, "select", perm.selectPerm);
    await rb(!!perm.updatePerm, "update", perm.updatePerm);
    await rb(!!perm.deletePerm, "delete", perm.deletePerm);

    await rb(!!perm.insertPerm, "insert", perm.insertPerm);
    await rb(!!perm.selectPerm, "select", perm.selectPerm);
    await rb(!!perm.updatePerm, "update", perm.updatePerm);
    await rb(!!perm.deletePerm, "delete", perm.deletePerm);
  }

  static async syncComputedField(cf: IComputedField, conn: Connection) {
    const table =
      typeof cf.entity === "string"
        ? cf.entity
        : conn.getMetadata(cf.entity).tableName;
    return await this.fetchHasura("/v1/query", {
      type: "add_computed_field",
      args: {
        table: {
          name: table,
          schema: "public",
        },
        name: this.name,
        definition: {
          function: {
            name: cf.function_name,
            schema: "public",
          },
          table_argument: cf.table_argument,
          session_argument: cf.session_argument,
        },
      },
    });
  }
}
