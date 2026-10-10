// Package schema describes the browsable relations of a database, read from pg_catalog.
package schema

const (
	CategoryText     = "text"
	CategoryNumber   = "number"
	CategoryTemporal = "temporal"
	CategoryBoolean  = "boolean"
	CategoryEnum     = "enum"
	CategoryJSON     = "json"
	CategoryOther    = "other"
)

type Schema struct {
	Tables []Table `json:"tables"`
}

type Table struct {
	Schema       string       `json:"schema"`
	Name         string       `json:"name"`
	Kind         string       `json:"kind"`
	Columns      []Column     `json:"columns"`
	PrimaryKey   []string     `json:"primaryKey"`
	ForeignKeys  []ForeignKey `json:"foreignKeys"`
	ReferencedBy []ForeignKey `json:"referencedBy"`
}

type Column struct {
	Name       string   `json:"name"`
	Type       string   `json:"type"`
	CastType   string   `json:"castType"`
	Category   string   `json:"category"`
	Nullable   bool     `json:"nullable"`
	Sortable   bool     `json:"sortable"`
	EnumValues []string `json:"enumValues"`
}

type ForeignKey struct {
	Name        string   `json:"name"`
	FromSchema  string   `json:"fromSchema"`
	FromTable   string   `json:"fromTable"`
	FromColumns []string `json:"fromColumns"`
	ToSchema    string   `json:"toSchema"`
	ToTable     string   `json:"toTable"`
	ToColumns   []string `json:"toColumns"`
}

func (s *Schema) Table(schema, name string) (*Table, bool) {
	for i := range s.Tables {
		if s.Tables[i].Schema == schema && s.Tables[i].Name == name {
			return &s.Tables[i], true
		}
	}
	return nil, false
}

func (t *Table) Column(name string) (*Column, bool) {
	for i := range t.Columns {
		if t.Columns[i].Name == name {
			return &t.Columns[i], true
		}
	}
	return nil, false
}

func category(typname, typcategory string) string {
	switch typname {
	case "json", "jsonb":
		return CategoryJSON
	}
	switch typcategory {
	case "S":
		return CategoryText
	case "N":
		return CategoryNumber
	case "D", "T":
		return CategoryTemporal
	case "B":
		return CategoryBoolean
	case "E":
		return CategoryEnum
	}
	return CategoryOther
}

// sortable is false for types without a default btree ordering.
func sortable(typname string) bool {
	switch typname {
	case "json", "xml", "point", "line", "lseg", "box", "path", "polygon", "circle":
		return false
	}
	return true
}

func kind(relkind string) string {
	switch relkind {
	case "v":
		return "view"
	case "m":
		return "materialized_view"
	case "f":
		return "foreign_table"
	}
	return "table"
}
