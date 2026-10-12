Feature: Reset the simulation

  Scenario: Reset while running clears lanes and elapsed time, pauses, and keeps settings
    Given I set "AI generation (PRs/hr)" to 40 and "PR size (LOC, both lanes)" to 300
    And the simulation is running and has run for 3 seconds
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0
    And the elapsed readout shows "0.0 work hours"
    And the Start/Pause button reads "Start"
    And "AI generation (PRs/hr)" has value 40 and "PR size (LOC, both lanes)" has value 300

  Scenario: Reset while paused with non-zero counts clears them
    Given the simulation ran for 3 seconds and was paused
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0

  Scenario: Counts stay at zero after Reset
    Given I pressed Reset while running
    When 5 seconds pass
    Then both lanes still show Pending Review 0 and Deployed 0

  Scenario: Reset on a fresh page changes nothing
    Given I open the simulator
    When I press Reset
    Then both lanes show Pending Review 0 and Deployed 0 and the Start/Pause button reads "Start"

  Scenario: Start after Reset runs from zero with the kept settings
    Given I set "AI generation (PRs/hr)" to 40 and pressed Reset
    When I press Start and 1 second passes
    Then the AI lane shows Pending Review 38 and Deployed 1

  Scenario: Reset is keyboard operable
    Given the simulation has run for 1 second
    When I Tab to "Reset" and press Enter
    Then both lanes show Pending Review 0 and Deployed 0
