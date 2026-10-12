// Turns .feature source into the step lists each scenario's test must run, in order.
// A step line is the keyword plus its text, e.g. 'Given I open the simulator'.
// Background steps come first; outline placeholders are filled from each Examples row.
import { AstBuilder, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import { IdGenerator } from '@cucumber/messages'

const stepLine = ({ keyword, text }) => `${keyword.trim()} ${text}`

const fillPlaceholders = (line, header, row) =>
  header.reduce((filled, name, column) => filled.replaceAll(`<${name}>`, row[column]), line)

const cellValues = (tableRow) => tableRow.cells.map(({ value }) => value)

const variantsOf = (scenario, lines) => {
  const tables = scenario.examples.filter(({ tableHeader }) => tableHeader)
  if (tables.length === 0) return [{ example: null, steps: lines }]
  return tables.flatMap(({ tableHeader, tableBody }) => {
    const header = cellValues(tableHeader)
    return tableBody.map((tableRow) => {
      const row = cellValues(tableRow)
      return {
        example: row.join(' | '),
        steps: lines.map((line) => fillPlaceholders(line, header, row)),
      }
    })
  })
}

const backgroundStepsOf = (children) =>
  children.flatMap(({ background }) => (background ? background.steps.map(stepLine) : []))

const scenariosOf = (children, inheritedSteps, uri) => {
  const backgroundSteps = [...inheritedSteps, ...backgroundStepsOf(children)]
  return children.flatMap(({ rule, scenario }) => {
    if (rule) return scenariosOf(rule.children, backgroundSteps, uri)
    if (!scenario) return []
    const lines = [...backgroundSteps, ...scenario.steps.map(stepLine)]
    return [
      {
        name: scenario.name,
        location: `${uri}:${scenario.location.line}`,
        variants: variantsOf(scenario, lines),
      },
    ]
  })
}

export const scenariosFromFeature = (source, uri) => {
  const parser = new Parser(new AstBuilder(IdGenerator.uuid()), new GherkinClassicTokenMatcher())
  const { feature } = parser.parse(source)
  return feature ? scenariosOf(feature.children, [], uri) : []
}
