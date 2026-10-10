// Package browse builds and runs the read-only, paginated, filtered queries behind table tabs.
package browse

import "kangourou/internal/schema"

const PageSize = 200

const (
	OpEq         = "eq"
	OpNeq        = "neq"
	OpLt         = "lt"
	OpGt         = "gt"
	OpBetween    = "between"
	OpContains   = "contains"
	OpStartsWith = "starts_with"
	OpIsNull     = "is_null"
	OpIsNotNull  = "is_not_null"
	OpIsEmpty    = "is_empty"
)

var opsByCategory = map[string][]string{
	schema.CategoryText:     {OpContains, OpEq, OpStartsWith, OpIsNull, OpIsNotNull, OpIsEmpty},
	schema.CategoryNumber:   {OpEq, OpNeq, OpLt, OpGt, OpBetween, OpIsNull, OpIsNotNull},
	schema.CategoryTemporal: {OpEq, OpNeq, OpLt, OpGt, OpBetween, OpIsNull, OpIsNotNull},
	schema.CategoryBoolean:  {OpEq, OpIsNull, OpIsNotNull},
	schema.CategoryEnum:     {OpEq, OpIsNull, OpIsNotNull},
	schema.CategoryJSON:     {OpContains, OpIsNull, OpIsNotNull},
	schema.CategoryOther:    {OpEq, OpIsNull, OpIsNotNull},
}

func AllowedOps(category string) []string { return opsByCategory[category] }

type Filter struct {
	Column string `json:"column"`
	Op     string `json:"op"`
	Value  string `json:"value"`
	Value2 string `json:"value2"`
}

type Sort struct {
	Column string `json:"column"`
	Desc   bool   `json:"desc"`
}

type Request struct {
	Schema  string   `json:"schema"`
	Table   string   `json:"table"`
	Filters []Filter `json:"filters"`
	Sort    *Sort    `json:"sort,omitempty"`
	Page    int      `json:"page"`
}

type Result struct {
	Columns         []string    `json:"columns"`
	Rows            [][]*string `json:"rows"`
	PrimaryKey      []string    `json:"primaryKey"`
	Total           int64       `json:"total"`
	TotalIsEstimate bool        `json:"totalIsEstimate"`
	HasMore         bool        `json:"hasMore"`
	Page            int         `json:"page"`
	PageSize        int         `json:"pageSize"`
}

type Query struct {
	SQL  string
	Args []any
}

type CastCheck struct {
	Column string
	SQL    string
	Value  string
}
