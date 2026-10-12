Feature: Review quality metrics

  Scenario: Defects caught and pending LOC at rest
    Given I open the simulator
    Then the Human lane shows Defects caught 65% and Pending LOC 0
    And the AI lane shows Defects caught 15% and Pending LOC 0

  Scenario Outline: Defects caught follows PR size
    Given I set "Human code written (LOC/hr)" to <loc> and "Human PRs per day" to <perDay>
    Then the Human lane shows "PR size <size> LOC (derived)" and Defects caught <caught>

    Examples:
      | loc | perDay | size  | caught |
      | 25  | 4      | 50    | 80%    |
      | 25  | 1      | 200   | 80%    |
      | 75  | 2      | 300   | 42%    |
      | 50  | 1      | 400   | 4%     |
      | 125 | 1      | 1,000 | 4%     |

  Scenario Outline: Defects caught follows reviewer speed
    Given I set "Human code written (LOC/hr)" to 25 and "Reviewer speed (LOC/hr, both lanes)" to <speed>
    Then the Human lane shows Defects caught <caught>

    Examples:
      | speed | caught |
      | 500   | 80%    |
      | 750   | 44%    |
      | 900   | 22%    |
      | 1000  | 8%     |

  Scenario: Skimming harder lowers AI defects caught
    Given I set "AI skim multiplier" to 3
    Then the AI lane shows Defects caught 5%

  Scenario: Reviewing AI code at human pace restores some catching
    Given I set "AI skim multiplier" to 1
    Then the AI lane shows Defects caught 18%

  Scenario: Incident metrics at rest
    Given I open the simulator
    Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h
    And the headline ratio shows "—"

  Scenario: Default metrics after 10 seconds
    Given I open the simulator
    When I press Start and 10 seconds pass
    Then the Human lane shows Incidents 2, Incidents per PR 1.69, Pickup wait 0.0 h
    And the AI lane shows Incidents 9, Incidents per PR 6.16, Pickup wait 0.0 h, Pending LOC 0
    And the headline ratio shows "3.65×"

  Scenario: The research effect emerges at the defaults
    Given the simulation is running and has run for 10 seconds with defaults
    Then the headline ratio is between 3 and 4

  Scenario: Incidents per PR waits for a whole deployed PR
    Given I open the simulator
    When I press Start and 7.9 seconds pass
    Then the Human lane shows Deployed 0 and Incidents per PR "—"
    And the headline ratio shows "—"
    When 0.1 more seconds pass
    Then the Human lane shows Deployed 1 and Incidents per PR 1.69

  Scenario: Larger PRs accrue more incidents
    Given I set "Human code written (LOC/hr)" to 50
    When I press Start and 10 seconds pass
    Then the Human lane shows Pending Review 0, Deployed 1, Incidents 9, and Incidents per PR 7.68

  Scenario: A size change while running changes defects caught and accrual on the next tick
    Given the simulation is running and has run for 1 second with defaults
    When I set "Human code written (LOC/hr)" to 50
    And 0.1 seconds pass
    Then the Human lane shows Defects caught 4%
    When 8.9 more seconds pass
    Then the Human lane shows Incidents 8 and Incidents per PR 7.08

  Scenario: A PR-frequency change while running changes defects caught and accrual on the next tick
    Given the simulation is running and has run for 1 second with defaults
    When I set "Human PRs per day" to 0.25
    And 0.1 seconds pass
    Then the Human lane shows Defects caught 4%
    When 8.9 more seconds pass
    Then the Human lane shows Incidents 5, Deployed 0, and Incidents per PR "—"

  Scenario: A reviewer-speed change while running changes defects caught and accrual on the next tick
    Given the simulation is running and has run for 1 second with defaults
    When I set "Reviewer speed (LOC/hr, both lanes)" to 900
    And 0.1 seconds pass
    Then the Human lane shows Defects caught 18%
    When 8.9 more seconds pass
    Then the Human lane shows Incidents 4 and Incidents per PR 3.71

  Scenario: Queued PRs keep their size when PR size changes
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds
    And the AI lane shows Pending Review 7 and Pending LOC 2,800
    When I pause, set "Human PRs per day" to 0.5, and press Start
    And 1 second passes
    Then the AI lane shows Pending Review 9 and Pending LOC 4,200

  Scenario: A drained queue shows no wait
    Given I set "AI code written (LOC/hr)" to 2000 and the simulation is running and has run for 2 seconds
    When I set "AI code written (LOC/hr)" to 5 and "Reviewer speed (LOC/hr, both lanes)" to 1000
    And 6 seconds pass
    Then the AI lane shows Pending Review 0, Pickup wait 0.0 h, and Defects caught 2%

  Scenario: Incidents never decrease while running
    Given I set "AI code written (LOC/hr)" to 2000 and press Start
    Then each lane's Incidents count, sampled every tick for 10 seconds, never decreases

  Scenario: Reset clears the metrics
    Given the simulation is running and has run for 10 seconds
    When I press Reset
    Then both lanes show Incidents 0, Incidents per PR "—", and Pickup wait 0.0 h
    And the headline ratio shows "—"
