import { Connection, createConnection } from "typeorm";
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
    await this.conn.synchronize(dropDatabase);

    await HasuraFunctions.reloadHasura();
  }
}
