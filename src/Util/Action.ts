import { IField } from "./CustomTypes";

export interface IAction<T = any> {
  name: string;
  kind: "synchronous" | "asynchronous";
  args: IField[];
  output_type: string;
  timeout_seconds?: number;
  description?: string;
  fn: (data: {
    session_variables: Record<string, any>;
    input: T;
    action: { name: string };
  }) => any;
  users: string[];
  url?: string;
}
