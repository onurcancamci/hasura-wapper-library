interface IMethodWPayload {
  columns: string[] | "*";
  payload: string[] | "*";
}

interface IMethodWOPayload {
  columns: string[] | "*";
}

export interface IEventHookData {
  event: {
    session_variables: Record<string, any>;
    op: "INSERT" | "UPDATE" | "DELETE" | "MANUAL";
    data: { old: null; new: Record<string, any> };
    trace_context: any;
  };
  created_at: string; // ISO date string
  id: string;
  delivery_info: { max_retries: number; current_retry: number };
  trigger: { name: string };
  table: { schema: string; name: string };
}

export interface IEventHook {
  name: string;
  entity: Function | string;
  fn: (event: IEventHookData) => any;
  insertConf?: IMethodWPayload;
  updateConf?: IMethodWPayload;
  deleteConf?: IMethodWOPayload;
  url?: string;
}
