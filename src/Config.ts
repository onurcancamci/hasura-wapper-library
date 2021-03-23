import { EntitySchema } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { IAction } from "./Util/Action";
import { IComputedField } from "./Util/ComputedField";
import { ICustomInputType, ICustomObjectType } from "./Util/CustomTypes";
import { IEventHook } from "./Util/EventHook";
import { IPerm } from "./Util/Perm";
import { IRemoteSchema } from "./Util/RemoteSchema";

export interface IHasuraConfig {
  database: Omit<PostgresConnectionOptions, "entities" | "synchronize">;

  entities: (Function | EntitySchema<any>)[];
  perms?: (IPerm | IPerm[])[];
  customFunctions?: (string | string[])[];
  computedFields?: (IComputedField | IComputedField[])[];
  eventHooks?: (IEventHook | IEventHook[])[];
  remoteSchemas?: (IRemoteSchema | IRemoteSchema[])[];
  customTypes?: (ICustomObjectType | ICustomInputType[])[];
  customActions?: (IAction | IAction[])[];

  hasura: {
    url: string;
    adminSecret: string;
  };
  webhook: {
    url: string;
  };

  auth: {
    //
  };
}
