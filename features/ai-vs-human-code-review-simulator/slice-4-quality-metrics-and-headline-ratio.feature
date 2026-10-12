Feature: Review quality metrics

  Scenario: Defects caught and pending LOC at rest
    Given I open the simulator
    Then the Human lane shows Defects caught 61% and Pending LOC 0
    And the AI lane shows Defects caught 10% and Pending LOC 0

  Scenario Outline: Defects caught follows PR size
    Given I set "PR size (LOC, both lanes)" to <size>
    Then the Human lane shows Defects caught <caught>

    Examples:
      | size | caught |
      | 50   | 80%    |
      | 200  | 80%    |
      | 300  | 42%    |
      | 400  | 4%     |
      | 1000 | 4%     |

  Scenario Outline: Defects caught follows reviewer speed
    Given I set "PR size (LOC, both lanes)" to 200 and "Reviewer speed (LOC/hr, both lanes)" to <speed>
    Then the Human lane shows Defects caught <caught>

    Examples:
      | speed | caught |
      | 500   | 80%    |
      | 750   | 44%    |
      | 900   | 22%    |
      | 1000  | 8%     |

  Scenario: Skimming harder lowers AI defects caught
    Given I set "AI skim multiplier" to 3
    Then the AI lane shows Defects caught 3%

  Scenario: Reviewing AI code at human pace restores some catching
    Given I set "AI skim multiplier" to 1
    Then the AI lane shows Defects caught 12%

  Scenario: Incident metrics at rest
    Given I open the simulator
    Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h
    And the headline ratio shows "—"

  Scenario: Default metrics after 10 seconds
    Given I open the simulator
    When I press Start and 10 seconds pass
    Then the Human lane shows Incidents 19, Incidents per PR 1.95, Pickup wait 0.0 h
    And the AI lane shows Incidents 107, Incidents per PR 6.79, Pickup wait 116.0 h, Pending LOC 69,600
    And the headline ratio shows "3.48×"

  Scenario: The research effect emerges at the defaults
    Given the simulation has run for 10 seconds with defaults
    Then the headline ratio is between 3 and 4

  Scenario: Incidents per PR waits for a whole deployed PR
    Given I open the simulator
    When I press Start and 0.9 seconds pass
    Then the Human lane shows Deployed 0 and Incidents per PR "—"
    And the headline ratio shows "—"
    When 0.1 more seconds pass
    Then the Human lane shows Deployed 1 and Incidents per PR 1.95

  Scenario: Larger PRs accrue more incidents
    Given I set "PR size (LOC, both lanes)" to 400
    When I press Start and 10 seconds pass
    Then the Human lane shows Pending Review 2, Deployed 7, Incidents 57, and Incidents per PR 7.68

  Scenario: A size change while running changes defects caught and accrual on the next tick
    Given the simulation has run for 1 second with defaults
    When I set "PR size (LOC, both lanes)" to 400
    And 0.1 seconds pass
    Then the Human lane shows Defects caught 4%
    When 8.9 more seconds pass
    Then the Human lane shows Incidents 53 and Incidents per PR 6.94

  Scenario: Queued PRs keep their size when PR size changes
    Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds
    And the Human lane shows Pending Review 17 and Pending LOC 4,400
    When I pause, set "PR size (LOC, both lanes)" to 500, and press Start
    And 1 second passes
    Then the Human lane shows Pending Review 26 and Pending LOC 9,100

  Scenario: A drained queue shows no wait
    Given I set "Human generation (PRs/hr)" to 10 and the simulation has run for 2 seconds
    When I set "Human generation (PRs/hr)" to 1 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 6 seconds pass
    Then the Human lane shows Pending Review 0, Pickup wait 0.0 h, and Defects caught 6%

  Scenario: Incidents never decrease while running
    Given I press Start
    Then each lane's Incidents count, sampled every tick for 10 seconds, never decreases

  Scenario: Reset clears the metrics
    Given the simulation has run for 10 seconds
    When I press Reset
    Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h
    And the headline ratio shows "—"
