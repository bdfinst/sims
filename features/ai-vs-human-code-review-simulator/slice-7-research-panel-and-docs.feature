Feature: Research behind the simulation

  Scenario: Panel is collapsed by default
    Given I open the simulator
    Then the "Research behind this simulation" toggle is collapsed
    And no research findings are visible

  Scenario: Expanding shows every finding verbatim with its source
    Given I open the simulator
    When I expand "Research behind this simulation"
    Then the panel contains "2,500 reviews of 3.2 million lines of code over 10 months"
    And the panel contains "Review no more than 200–400 LOC at a time"
    And the panel contains "faster than 500 LOC/hour"
    And the panel contains "high AI adoption saw PR size +51%, PR merge rate +16.2%, and 3× incidents per PR (+242.7%)"
    And the panel contains "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up"
    And the panel contains "practitioner observation" and "locally coherent but globally brittle"
    And the panel links to all five source URLs from the spec's Research Sources table, each opening in a new tab

  Scenario: Unsupported or misattributing wording never appears
    Given I expand "Research behind this simulation"
    Then the page does not contain "near zero", "coined", or "originated"

  Scenario: Model assumptions and calibration are stated
    Given I expand "Research behind this simulation"
    Then the panel contains "These are modeling choices, not research findings"
    And the panel contains "the defect density (20 defects per 1,000 LOC)"
    And the panel contains "the base detection rate (0.8, picked from SmartBear's 70–90% range)"
    And the panel contains "the detection floors (0.05 for large PRs and 0.1 for fast reviewing)"
    And the panel contains "the curve thresholds (PR size 200 to 400 LOC, reviewer speed 500 to 1,000 LOC/hr)"
    And the panel contains "the human-lane defaults, an assumption (30 LOC/hr and 1 PR per day)"
    And the panel contains "The AI lane's PR size (1.51× the human PR size) and default volume (giving 1.162× the human PRs per day) come from Faros"
    And the panel contains "The human defaults were chosen to land near Faros's +242.7% incidents per PR"

  Scenario: Panel is keyboard operable and does not interrupt the simulation
    Given the simulation is running
    When I Tab to the research toggle and press Enter
    Then the panel expands and the status still reads "Running"

  Scenario: Panel fits a phone
    Given the viewport is 375 × 667
    When I expand "Research behind this simulation"
    Then the page does not scroll horizontally
