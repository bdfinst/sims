import { describe, expect, it } from 'vitest'
import { scenariosFromFeature } from './expectations.js'

const URI = 'features/example.feature'

describe('scenariosFromFeature', () => {
  it('lists each scenario step as its keyword plus text, with the scenario location', () => {
    const source = `Feature: Run
  Scenario: Start
    Given I open the simulator
    When I press Start
    Then the status reads "Running"
    And nothing else moves
`
    expect(scenariosFromFeature(source, URI)).toEqual([
      {
        name: 'Start',
        location: `${URI}:2`,
        variants: [
          {
            example: null,
            steps: [
              'Given I open the simulator',
              'When I press Start',
              'Then the status reads "Running"',
              'And nothing else moves',
            ],
          },
        ],
      },
    ])
  })

  it('puts Background steps before every scenario', () => {
    const source = `Feature: Tiles
  Background:
    Given the capacity C is read
  Scenario: One
    Then one thing
  Scenario: Two
    Then another thing
`
    const steps = scenariosFromFeature(source, URI).map(({ variants }) => variants[0].steps)
    expect(steps).toEqual([
      ['Given the capacity C is read', 'Then one thing'],
      ['Given the capacity C is read', 'Then another thing'],
    ])
  })

  it('expands a Scenario Outline into one variant per Examples row, filling every placeholder', () => {
    const source = `Feature: Bounds
  Scenario Outline: Sliders stop at their bounds
    When I press <key> 200 times on "<control>"
    Then the "<control>" slider has value <bound>

    Examples:
      | control | key        | bound |
      | AI gen  | ArrowRight | 50    |
      | AI gen  | ArrowLeft  | 5     |
`
    const [{ variants }] = scenariosFromFeature(source, URI)
    expect(variants).toEqual([
      {
        example: 'AI gen | ArrowRight | 50',
        steps: [
          'When I press ArrowRight 200 times on "AI gen"',
          'Then the "AI gen" slider has value 50',
        ],
      },
      {
        example: 'AI gen | ArrowLeft | 5',
        steps: [
          'When I press ArrowLeft 200 times on "AI gen"',
          'Then the "AI gen" slider has value 5',
        ],
      },
    ])
  })

  it('applies a Rule Background after the Feature Background, only inside that Rule', () => {
    const source = `Feature: Rules
  Background:
    Given the feature setup
  Scenario: Outside
    Then outside outcome
  Rule: Inside
    Background:
      Given the rule setup
    Scenario: Ruled
      Then ruled outcome
`
    const steps = scenariosFromFeature(source, URI).map(({ name, variants }) => [
      name,
      variants[0].steps,
    ])
    expect(steps).toEqual([
      ['Outside', ['Given the feature setup', 'Then outside outcome']],
      ['Ruled', ['Given the feature setup', 'Given the rule setup', 'Then ruled outcome']],
    ])
  })

  it('returns no scenarios for a file with no Feature', () => {
    expect(scenariosFromFeature('# just a comment\n', URI)).toEqual([])
  })
})
