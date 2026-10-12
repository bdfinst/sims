Feature: Slider info tips

  @wip
  Scenario Outline: Every slider has an info button after its label
    Given I open the simulator
    Then an "About <control>" button with an "info" icon directly follows the "<control>" label
    And the button is at least 24 by 24 pixels

    Examples:
      | control                              |
      | Warning threshold                    |
      | Human code written (LOC/hr)          |
      | Human PRs per day                    |
      | AI code written (LOC/hr)             |
      | Reviewer speed (LOC/hr, both lanes)  |
      | AI skim multiplier                   |

  @wip
  Scenario Outline: Each tip explains its slider and is the slider's description
    Given I open the simulator
    Then the "<control>" slider's accessible description contains "<phrase>"
    When I hover "About <control>"
    Then a tip is shown that contains "<phrase>"
    And the tip does not cover the "<control>" slider

    Examples:
      | control                              | phrase                                                                    |
      | Warning threshold                    | turns red when its count is above this many PRs                           |
      | Human code written (LOC/hr)          | lines of code the human lane writes, in LOC/hr                            |
      | Human PRs per day                    | Below 1, a PR spans more than one day                                     |
      | AI code written (LOC/hr)             | The AI queue grows once this exceeds the AI lane's effective review speed |
      | Reviewer speed (LOC/hr, both lanes)  | Defect discovery drops significantly faster than 500 LOC/hour             |
      | AI skim multiplier                   | AI PRs are reviewed 2× faster once picked up                              |

  @wip
  Scenario: The tip stays open while the pointer moves onto it
    Given I hover "About Reviewer speed (LOC/hr, both lanes)"
    When I move the pointer onto the tip
    Then the tip is still shown

  @wip
  Scenario: Moving the pointer away closes the tip
    Given I hover "About Reviewer speed (LOC/hr, both lanes)"
    When I move the pointer to the page title
    Then no tip is shown

  @wip
  Scenario: Keyboard focus opens the tip and Escape closes it
    Given I open the simulator
    When I Tab to "About AI skim multiplier"
    Then a tip is shown that contains "AI PRs are reviewed 2× faster once picked up"
    When I press Escape
    Then no tip is shown
    And focus is still on "About AI skim multiplier"

  @wip
  Scenario: Tabbing away from a focused info button closes its tip
    Given I Tab to "About Human PRs per day"
    When I press Tab
    Then no tip is shown

  @wip
  Scenario: A focused tip stays open when the pointer leaves
    Given I Tab to "About Human PRs per day" and hover it
    When I move the pointer to the page title
    Then the tip for "About Human PRs per day" is still shown

  @wip
  Scenario: A hovered tip stays open when focus moves away
    Given I Tab to "About Human PRs per day" and hover it
    When I press Tab
    Then the tip for "About Human PRs per day" is still shown

  @wip
  Scenario: Escape closes a hovered tip without moving the pointer
    Given I hover "About Human PRs per day"
    When I press Escape
    Then no tip is shown
    When I move the pointer to the page title and back onto "About Human PRs per day"
    Then the tip for "About Human PRs per day" is shown

  @wip
  Scenario: Clicking the info button toggles its tip
    Given I open the simulator
    When I Tab to "About Warning threshold" and press Enter
    And I press Tab
    Then the tip for "About Warning threshold" is still shown
    When I press Shift+Tab and Enter
    Then no tip is shown

  @wip
  Scenario: A clicked tip stays open after the pointer leaves
    Given I hover "About Reviewer speed (LOC/hr, both lanes)"
    When I click "About Reviewer speed (LOC/hr, both lanes)"
    And I move the pointer to the page title
    Then the tip for "About Reviewer speed (LOC/hr, both lanes)" is still shown
    When I click "About Reviewer speed (LOC/hr, both lanes)" again
    Then no tip is shown

  @wip
  Scenario: A tap opens a tip and a tap elsewhere closes it
    Given I open the simulator on a touch device
    When I tap "About AI code written (LOC/hr)"
    Then the tip for "About AI code written (LOC/hr)" is shown
    When I tap the page title
    Then no tip is shown

  @wip
  Scenario: Opening one tip closes the other
    Given I hover "About Human PRs per day"
    When I Tab to "About Warning threshold"
    Then exactly one tip is shown and it contains "turns red when its count is above this many PRs"

  @wip
  Scenario: Hovering the slider itself shows no tip
    Given I open the simulator
    When I hover the "Reviewer speed (LOC/hr, both lanes)" slider
    Then no tip is shown

  @wip
  Scenario: Tips never use unsupported or misattributing wording
    Given I open the simulator
    When I hover each info button in turn
    Then no tip contains "near zero", "coined", or "originated"

  @wip
  Scenario: Opening a tip does not interrupt the simulation
    Given the simulation is running
    When I hover "About AI code written (LOC/hr)"
    Then the status still reads "Running"

  @wip
  Scenario: Closed tips are hidden and take no space at 1280 × 720
    Given the viewport is 1280 × 720
    Then every tip is hidden and takes no space

  @wip
  Scenario: Opening a tip moves no lane element
    Given the viewport is 1280 × 720
    When I hover "About Reviewer speed (LOC/hr, both lanes)"
    Then no element in either lane has moved

  @wip
  Scenario Outline: An open tip fits a narrow screen
    Given the viewport is <width> × <height>
    When I Tab to "About <control>"
    Then the tip is fully inside the viewport
    And the page does not scroll horizontally

    Examples:
      | width | height | control                              |
      | 320   | 568    | Warning threshold                    |
      | 320   | 568    | Human code written (LOC/hr)          |
      | 320   | 568    | Human PRs per day                    |
      | 320   | 568    | AI code written (LOC/hr)             |
      | 320   | 568    | Reviewer speed (LOC/hr, both lanes)  |
      | 320   | 568    | AI skim multiplier                   |
      | 375   | 667    | AI code written (LOC/hr)             |
