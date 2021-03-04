type GenericOperators =
  | "$eq"
  | "$ne"
  | "$gt"
  | "$lt"
  | "$gte"
  | "$lte"
  | "$in"
  | "$nin";

type TextOperators =
  | "$like"
  | "$nlike"
  | "$ilike"
  | "$nilike"
  | "$similar"
  | "$nsimilar";

type ColumnCompareOperators =
  | "$ceq"
  | "$cne"
  | "$cgt"
  | "$clt"
  | "$cgte"
  | "$clte";

type NullableOperators = "_is_null";

type JSONBOperators =
  | "_contains"
  | "_contained_in"
  | "_has_key"
  | "_has_keys_any"
  | "_has_keys_all";

type GeometryOperators =
  | "_st_contains"
  | "_st_crosses"
  | "_st_equals"
  | "_st_intersects"
  | "_st_overlaps"
  | "_st_touches"
  | "_st_within"
  | "_st_d_within";

type Operators =
  | GenericOperators
  | TextOperators
  | ColumnCompareOperators
  | NullableOperators
  | JSONBOperators
  | GeometryOperators;

type AndExpr = { $and: BoolExpr[] };
type OrExpr = { $or: BoolExpr[] };
type NotExpr = { $not: BoolExpr };
type ExistsExpr = {
  $exists: {
    _table: string;
    _where: BoolExpr;
  };
};
type TrueExpr = {};
type ColumnExpr = Record<string, Record<Operators, any>>;

type BoolExpr = AndExpr | OrExpr | NotExpr | ExistsExpr | TrueExpr | ColumnExpr;

export interface InsertPerm {
  check: BoolExpr;
  columns?: string[] | "*";
  set?: Record<string, any>;
  backend_only?: boolean;
}

export interface SelectPerm {
  filter: BoolExpr;
  columns: string[] | "*";
  computed_fields?: string[];
  limit?: number;
  allow_aggregations?: boolean;
}

export interface UpdatePerm {
  columns: string[] | "*";
  filter: BoolExpr;
  check?: BoolExpr;
  set?: Record<string, any>;
}

export interface DeletePerm {
  filter: BoolExpr;
}

export interface IPerm {
  entity: Function | "string";
  role: string;
  insertPerm: InsertPerm | null;
  selectPerm: SelectPerm | null;
  updatePerm: UpdatePerm | null;
  deletePerm: DeletePerm | null;
}
