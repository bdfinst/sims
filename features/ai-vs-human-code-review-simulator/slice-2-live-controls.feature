Feature: Adjust the model live

  Scenario Outline: Controls start at their defaults with units
    Given I open the simulator
    Then the "<control>" slider has value <default>, min <min>, max <max>, and step <step>
    And its visible value reads "<shown>"

    Examples:
      | control                              | default | min | max  | step | shown        |
      | Human generation (PRs/hr)            | 1       | 1   | 10   | 1    | 1 PRs/hr     |
      | AI generation (PRs/hr)               | 20      | 5   | 50   | 1    | 20 PRs/hr    |
      | PR size (LOC, both lanes)            | 250     | 50  | 1000 | 10   | 250 LOC      |
      | Reviewer speed (LOC/hr, both lanes)  | 300     | 100 | 1000 | 50   | 300 LOC/hr   |
      | AI skim multiplier                   | 2       | 1   | 3    | 0.5  | 2×           |

  Scenario: AI PR size and effective speed are derived and read-only
    Given I open the simulator
    Then the AI lane shows "PR size 378 LOC" and "Effective speed 600 LOC/hr", each marked "derived"
    And neither derived value is a slider
    When I set "PR size (LOC, both lanes)" to 200 and "AI skim multiplier" to 3
    Then the AI lane shows "PR size 302 LOC" and "Effective speed 900 LOC/hr"

  Scenario Outline: Sliders stop at their bounds
    Given I open the simulator
    When I press <key> 200 times on "<control>"
    Then the "<control>" slider has value <bound>

    Examples:
      | control                              | key        | bound |
      | AI generation (PRs/hr)               | ArrowRight | 50    |
      | AI generation (PRs/hr)               | ArrowLeft  | 5     |
      | Reviewer speed (LOC/hr, both lanes)  | ArrowLeft  | 100   |
      | AI skim multiplier                   | ArrowRight | 3     |

  Scenario: A review-side change applies on the next tick
    Given the simulation has run for 1 second with defaults
    And the AI lane shows Deployed 1
    When I set "Reviewer speed (LOC/hr, both lanes)" to 1000 and "AI skim multiplier" to 3
    And 0.1 seconds pass
    Then the AI lane shows Deployed 2
    And the Start/Pause button still reads "Pause"

  Scenario: A change while paused takes effect only after Start
    Given the simulation ran for 1 second and was paused
    And the AI lane shows Pending Review 18
    When I set "AI generation (PRs/hr)" to 50
    Then the AI lane still shows Pending Review 18
    When I press Start and 0.1 seconds pass
    Then the AI lane shows Pending Review 23

  Scenario: A backlog drains to zero and never below
    Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds
    And the Human lane shows Pending Review 17
    When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 6 seconds pass
    Then the Human lane shows Pending Review 0
    And the Human Pending Review count, sampled every tick, was never below 0

  Scenario: Sliders are keyboard operable
    Given I open the simulator
    When I Tab to "Reviewer speed (LOC/hr, both lanes)" and press ArrowRight
    Then that slider has value 350 and its visible value reads "350 LOC/hr"
