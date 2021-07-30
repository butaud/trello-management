# trello-management
Scripts for managing trello board through API

## Overview
Currently this does one thing:

`yarn start`:

Triggers a script to do some housekeeping on my GTDish Trello board. I keep one "Done - this week" list where tasks go as I finish them, and then when the week is over,
that list gets renamed to "Done - week of <Monday's date>" and moved to the back part of the board and a new "Done - this week" list gets created. When the new week starts
in a different month from the previous week, the previous week list gets renamed to "Done - <month>/<year>" instead, and all of the weekly lists from that month get
consolidated into it. This script automates the process.

## Architecture
Currently very rough - there is a `TrelloClient` class which wraps calls to the Trello REST API, and a `logic.ts` file which contains the "business logic" - i.e. the logic
around which lists get renamed and moved and created. Then there is an `index.ts` file which instantiates the `TrelloClient` and runs the business logic methods, supplying 
user input when necessary.

There are two key/value local storage mechanisms - config, which is checked in as a JSON file, and db, which is not checked in but is also a JSON file.

### Trello ordering
The only really interesting logic is around reordering lists on a board. Trello uses an interesting mechanism for ordering their lists and cards so that they can be moved
without requiring an update to all of the other lists and cards. Each list or card has a `pos` property which is a floating point positive number, then the ordering
is just defined as the sorted set by that property. Trello has some kind of algorithm on their end that ensures new items have large gaps in `pos` from existing items so
that they can be moved around many times before they need to be "spread out" again.

This has the effect of making reordering pretty tricky, since you want to space your moved item pretty far out from items on either side of it. I went with a simple algorithm
which should work as long as there aren't so many items that the value overflows or two items so close together that the difference between them requires greater precision than
available in a Javascript float. In a nutshell, the pos of the reordered item is just the halfway point of the two items on either side of it. If there is no prior item, 0 is
substituted. If there is no subsequent item, 32,768 is added to the last item's pos. This logic is encapsulated in `TrelloClient` which doesn't expose `pos` and instead allows
the caller to reorder an item by providing an index.

## Usage
To use this script, follow these steps:
1. Clone the repo
2. Obtain your [Trello app key and auth token](https://developer.atlassian.com/cloud/trello/guides/rest-api/api-introduction/)
3. Update `config.json` to save the app key (which is not private).
4. Run `yarn` to install dependencies.
5. Run `yarn start`.

You will be prompted for your auth token and then you can select the board you want to operate on. (Both of these are saved in the local db.json so you don't have to 
enter them every time). If you don't already have your Trello board set up like mine, it will prompt you where in the board to insert the "Done - this week" list and
where to put the old lists. Once you have indicated those it will automatically put them in the same place every time.
