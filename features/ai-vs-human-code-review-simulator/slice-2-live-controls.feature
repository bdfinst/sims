Feature: Adjust the model live

  Scenario Outline: Controls start at their defaults with units
    Given I open the simulator
    Then the "<control>" slider has value <default>, min <min>, max <max>, and step <step>
    And its visible value reads "<shown>"

    Examples:
      | control                              | default | min  | max  | step | shown      |
      | Human code written (LOC/hr)          | 30      | 5    | 200  | 5    | 30 LOC/hr  |
      | Human PRs per day                    | 1       | 0.25 | 4    | 0.25 | 1 PRs/day  |
      | AI code written (LOC/hr)             | 53      | 5    | 2000 | 1    | 53 LOC/hr  |
      | Reviewer speed (LOC/hr, both lanes)  | 300     | 100  | 1000 | 50   | 300 LOC/hr |
      | AI skim multiplier                   | 2       | 1    | 3    | 0.5  | 2×         |
      | Warning threshold                    | 15      | 5    | 50   | 1    | 15 PRs     |

  Scenario: Derived PR sizes, AI PRs per day, and effective speed are read-only
    Given I open the simulator
    Then the Human lane shows "PR size 240 LOC (derived)"
    And the AI lane shows "PR size 362 LOC (1.51× human)", "1.17 PRs/day (derived)", and "Effective speed 600 LOC/hr"
    And none of the derived values is a slider
    When I set "Human PRs per day" to 2 and "AI skim multiplier" to 3
    Then the Human lane shows "PR size 120 LOC (derived)"
    And the AI lane shows "PR size 181 LOC (1.51× human)", "2.34 PRs/day (derived)", and "Effective speed 900 LOC/hr"

  Scenario Outline: Sliders stop at their bounds
    Given I open the simulator
    When I press <key> <presses> times on "<control>"
    Then the "<control>" slider has value <bound>

    Examples:
      | control                              | key        | presses | bound |
      | Human code written (LOC/hr)          | ArrowRight | 40      | 200   |
      | Human code written (LOC/hr)          | ArrowLeft  | 10      | 5     |
      | Human PRs per day                    | ArrowLeft  | 10      | 0.25  |
      | Human PRs per day                    | ArrowRight | 20      | 4     |
      | Reviewer speed (LOC/hr, both lanes)  | ArrowLeft  | 200     | 100   |
      | Reviewer speed (LOC/hr, both lanes)  | ArrowRight | 200     | 1000  |
      | AI skim multiplier                   | ArrowRight | 200     | 3     |
      | AI skim multiplier                   | ArrowLeft  | 200     | 1     |
      | Warning threshold                    | ArrowLeft  | 50      | 5     |
      | Warning threshold                    | ArrowRight | 50      | 50    |

  Scenario Outline: The AI code-written slider jumps to its bounds
    Given I open the simulator
    When I press <key> on "AI code written (LOC/hr)"
    Then the "AI code written (LOC/hr)" slider has value <bound>

    Examples:
      | key  | bound |
      | End  | 2000  |
      | Home | 5     |

  Scenario: A review-side change applies on the next tick
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 1 second
    And the AI lane shows Deployed 1
    When I set "Reviewer speed (LOC/hr, both lanes)" to 1000 and "AI skim multiplier" to 3
    And 0.1 seconds pass
    Then the AI lane shows Deployed 2
    And the Start/Pause button still reads "Pause"

  Scenario: A change while paused takes effect only after Start
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation ran for 1 second and was paused
    And the AI lane shows Pending Review 3
    When I set "Reviewer speed (LOC/hr, both lanes)" to 100
    Then the AI lane still shows Pending Review 3
    When I press Start and 0.1 seconds pass
    Then the AI lane shows Pending Review 4

  Scenario: A backlog drains to zero and never below
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds
    And the AI lane shows Pending Review 7
    When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 2 seconds pass
    Then the AI lane shows Pending Review 0
    And the AI Pending Review count, sampled every tick, was never below 0

  Scenario: Sliders are keyboard operable
    Given I open the simulator
    When I Tab to "Reviewer speed (LOC/hr, both lanes)" and press ArrowRight
    Then that slider has value 350 and its visible value reads "350 LOC/hr"
