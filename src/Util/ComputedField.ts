export interface IComputedField {
  entity: string | Function;
  name: string;
  function_name: string;
  table_argument?: string;
  session_argument?: string;
}
