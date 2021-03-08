import { throws } from "assert";
import { config } from "process";
import { Connection, createConnection } from "typeorm";
import { of } from "zen-observable";
import { IHasuraConfig } from "./Config";
import { HasuraFunctions } from "./Util/HasuraFunctions";

export class Hasura {
  private conn!: Connection;
  private initDone: Promise<any>;

  constructor(public conf: IHasuraConfig) {
    this.initDone = this.init();
    HasuraFunctions.Configure(conf);
  }

  private async init() {
    this.conn = await createConnection({
      ...this.conf.database,
      entities: this.conf.entities,
      synchronize: false,
    });
  }

  async Sync(dropDatabase: boolean = false) {
    await this.initDone;
    const conn = this.conn;
    await conn.synchronize(dropDatabase);

    await HasuraFunctions.reloadHasura();

    for (const e of this.conf.entities) {
      const meta = conn.getMetadata(e);
      await HasuraFunctions.trackTable(meta.tableName);
    }

    await HasuraFunctions.syncRelations(conn);

    if (this.conf.perms) {
      for (const p of this.conf.perms) {
        if (Array.isArray(p)) {
          for (const perm of p) {
            await HasuraFunctions.permDropAll(perm, conn);
            await HasuraFunctions.permApplyTo(perm, conn);
          }
        } else {
          await HasuraFunctions.permDropAll(p, conn);
          await HasuraFunctions.permApplyTo(p, conn);
        }
      }
    }

    if (this.conf.customFunctions) {
      for (const cf of this.conf.customFunctions) {
        if (Array.isArray(cf)) {
          for (const c of cf) {
            await conn.query(c);
          }
        } else {
          await conn.query(cf);
        }
      }
    }

    await registerWithFn(
      this.conf.computedFields,
      conn,
      HasuraFunctions.syncComputedField.bind(HasuraFunctions),
    );

    await registerWithFn(
      this.conf.eventHooks,
      conn,
      HasuraFunctions.registerEventHook.bind(HasuraFunctions),
    );

    await registerWithFn(
      this.conf.remoteSchemas,
      conn,
      HasuraFunctions.addRemoteSchema.bind(HasuraFunctions),
    );

    await registerWithFn(
      this.conf.customTypes,
      conn,
      HasuraFunctions.registerCustomType.bind(HasuraFunctions),
    );

    await registerWithFn(
      this.conf.customActions,
      conn,
      HasuraFunctions.registerAction.bind(HasuraFunctions),
    );

    await HasuraFunctions.reloadHasura();
  }
}

async function registerWithFn(
  objs: (Record<string, any> | Record<string, any>[])[] | undefined,
  conn: Connection,
  fn: Function,
) {
  if (objs) {
    for (const eOrArr of objs) {
      if (Array.isArray(eOrArr)) {
        for (const e of eOrArr) {
          await fn(e, conn);
        }
      } else {
        await fn(eOrArr, conn);
      }
    }
  }
}
