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
    And the panel contains "PR size +51%" and "(+242.7%)"
    And the panel contains "AI PRs wait 4.6× longer before review, but are reviewed 2× faster once picked up"
    And the panel contains "practitioner observation" and "locally coherent but globally brittle"
    And the panel links to all five source URLs from the spec's Research Sources table, each opening in a new tab

  Scenario: Unsupported or misattributing wording never appears
    Given I expand "Research behind this simulation"
    Then the page does not contain "near zero", "coined", or "originated"

  Scenario: Model assumptions and calibration are stated
    Given I expand "Research behind this simulation"
    Then the panel states that defect density, the base detection rate, the detection floors, the curve thresholds, and the 1.51 size multiplier are modeling choices
    And the panel states that the defaults were calibrated to land near Faros's +242.7% incidents per PR

  Scenario: Panel is keyboard operable and does not interrupt the simulation
    Given the simulation is running
    When I Tab to the research toggle and press Enter
    Then the panel expands and the status still reads "Running"

  Scenario: Panel fits a phone
    Given the viewport is 375 × 667
    When I expand "Research behind this simulation"
    Then the page does not scroll horizontally
