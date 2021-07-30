import TrelloClient, { List } from "./service/Trello";
import date from "date-and-time";

const currentDoneListName = "Done - this week";

const modulo = (a: number, n: number) => ((a % n) + n) % n;
// Number of days needed to subtract to get to the most recent Monday (inclusive of today)
const getMondayOffset = () => modulo(new Date().getDay() - 1, 7);

// the most recent Monday (incl. today)
const getThisMonday = () => {
  const thisMondayOffset = getMondayOffset();
  return date.addDays(new Date(), thisMondayOffset * -1);
};

// the Monday before the most recent one
const getLastMonday = () => {
  const lastMondayOffset = getMondayOffset() + 7;
  return date.addDays(new Date(), lastMondayOffset * -1);
};

const getLastWeekListName = () => {
  const lastMonday = getLastMonday();
  const thisMonday = getThisMonday();

  if (lastMonday.getMonth() === thisMonday.getMonth()) {
    return `Done - week of ${date.format(lastMonday, "M/D/YY")}`;
  } else {
    return `Done - ${date.format(lastMonday, "M/YYYY")}`;
  }
};

const findThisWeekDoneList = (allLists: List[]): number | undefined => {
  const index = allLists.findIndex((list) => list.name === currentDoneListName);
  return index >= 0 ? index : undefined;
};

const findLastWeekDoneList = (allLists: List[]): number | undefined => {
  const listToFind = getLastWeekListName();
  const index = allLists.findIndex((list) => list.name === listToFind);
  return index >= 0 ? index : undefined;
};

const findFirstOldDoneList = (allLists: List[]): number | undefined => {
  const index = allLists.findIndex(
    (list) =>
      list.name.startsWith("Done - week of") ||
      list.name.match("^Done - [0-9].*")
  );
  return index >= 0 ? index : undefined;
};

const confirmListPlacementInternal = async (
  allLists: Array<List>,
  index: number,
  confirmPlacement: (
    beforeContext: Array<List>,
    afterContext: Array<List>
  ) => Promise<boolean>
): Promise<boolean> => {
  const beforeContext = [allLists[index - 2], allLists[index - 1]].filter(
    (list) => list
  );
  const afterContext = [allLists[index], allLists[index + 1]].filter(
    (list) => list
  );
  return await confirmPlacement(beforeContext, afterContext);
};

export const maybeConsolidateLists = async (
  trelloClient: TrelloClient,
  selectedBoardId: string
): Promise<Array<string>> => {
  const allLists = await trelloClient.getLists(selectedBoardId);
  const listsConsolidated = new Array<string>();

  const doneMonths: Array<[string, string, string]> = (
    allLists
      .map((list) => [
        list.name.match("^Done - ([0-9][0-9]?/[0-9][0-9][0-9][0-9])$")?.[1],
        list.id,
      ])
      .filter(([match, id]) => match) as Array<[string, string]>
  ).map(([match, id]) => {
    const split = match.split("/");
    return [split[0], split[1], id];
  });

  await Promise.all(
    doneMonths.map(async ([month, year, monthListId]) => {
      const weekRegex = `^Done - week of ${month}/[0-9][0-9]?/${year.substring(
        2
      )}`;
      const listsToMerge = allLists.filter((list) =>
        list.name.match(weekRegex)
      );
      await Promise.all(
        listsToMerge.map(async (weekList) => {
          listsConsolidated.push(weekList.name);
          await trelloClient.moveAllCards(
            weekList.id,
            monthListId,
            selectedBoardId
          );
          await trelloClient.archiveList(weekList.id);
        })
      );
    })
  );
  return listsConsolidated;
};

export type MoveDoneListsResult = {
  movedDoneWeekList?: boolean;
  createdThisWeekList?: boolean;
};

export const moveDoneLists = async (
  trelloClient: TrelloClient,
  selectedBoardId: string,
  confirmListPlacement: (
    beforeContext: Array<List>,
    afterContext: Array<List>
  ) => Promise<boolean>,
  chooseListPlacement: (reason: string, lists: Array<List>) => Promise<number>
): Promise<MoveDoneListsResult> => {
  const lists = await trelloClient.getLists(selectedBoardId);

  const thisWeekDoneListIndex = findThisWeekDoneList(lists);
  const lastWeekDoneListIndex = findLastWeekDoneList(lists);

  if (thisWeekDoneListIndex && !lastWeekDoneListIndex) {
    const oldIndex = thisWeekDoneListIndex;
    let newIndex = thisWeekDoneListIndex;
    const firstOldDoneListIndex = findFirstOldDoneList(lists);

    if (firstOldDoneListIndex) {
      newIndex = firstOldDoneListIndex;
    } else {
      newIndex = await chooseListPlacement(
        "Can't find first old done list",
        lists
      );
    }

    if (
      await confirmListPlacementInternal(lists, newIndex, confirmListPlacement)
    ) {
      await trelloClient.moveListOnBoard(
        lists[thisWeekDoneListIndex].id,
        selectedBoardId,
        newIndex
      );
      await trelloClient.updateListName(
        lists[thisWeekDoneListIndex].id,
        getLastWeekListName()
      );

      // todo - consolidate month's lists if necessary

      await trelloClient.createList(
        selectedBoardId,
        currentDoneListName,
        oldIndex
      );

      // wait for propagation
      await new Promise((r) => setTimeout(r, 2000));

      const updatedLists = await trelloClient.getLists(selectedBoardId);
      updatedLists.forEach((list, index) => {
        if (index === oldIndex || list.id === lists[thisWeekDoneListIndex].id) {
          console.log(`*${list.name}*`);
        } else {
          console.log(list.name);
        }
      });
      return { movedDoneWeekList: true, createdThisWeekList: true };
    }
  } else if (!thisWeekDoneListIndex) {
    const createIndex = await chooseListPlacement(
      "No current week done list",
      lists
    );
    if (
      await confirmListPlacementInternal(
        lists,
        createIndex,
        confirmListPlacement
      )
    ) {
      await trelloClient.createList(
        selectedBoardId,
        currentDoneListName,
        createIndex
      );
    }
    return { createdThisWeekList: true };
  }
  return {};
};
