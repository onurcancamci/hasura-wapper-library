import { EntitySchema } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export interface IHasuraConfig {
  database: Omit<PostgresConnectionOptions, "entities" | "synchronize">;
  entities: (Function | EntitySchema<any>)[];
  hasura: {
    url: string;
    adminSecret: string;
  };
  webhook: {
    url: string;
  };
}
