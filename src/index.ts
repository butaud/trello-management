import cliSelect from "cli-select";
import prompts from "prompts";

import Trello, { Board, List } from "./service/Trello";
import { DbKey, fetchOrCacheInDb } from "./store/db";
import { moveDoneLists, maybeConsolidateLists } from "./logic";

const getAuthToken = (): Promise<string> =>
  fetchOrCacheInDb<string>(
    DbKey.TRELLO_APP_TOKEN,
    async () =>
      (
        await prompts({
          name: "token",
          message: "App token?",
          type: "text",
        })
      ).token
  );

const getSelectedBoardId = (trelloClient: Trello): Promise<string> =>
  fetchOrCacheInDb(DbKey.SAVED_BOARD_ID, async () => {
    const boards = await trelloClient.getBoards();
    const selection = await cliSelect<Board>({
      values: boards,
      valueRenderer: (board) => board.name,
    });
    return selection.value.id;
  });

const confirmListPlacement = async (
  beforeContext: Array<List>,
  afterContext: Array<List>
): Promise<boolean> => {
  const preview = [
    ...beforeContext.map((list) => list.name),
    "<----",
    ...afterContext.map((list) => list.name),
  ];
  console.log("List will go here:");
  preview.forEach((line) => line && console.log(line));
  const confirmation = await prompts({
    name: "proceed",
    message: "Proceed?",
    type: "confirm",
  });
  return !!confirmation.proceed;
};

const chooseListPlacement = async (
  reason: string,
  lists: Array<List>
): Promise<number> => {
  console.log(`${reason}. Please indicate after which list to place it.`);
  const selection = await cliSelect<List>({
    values: lists,
    valueRenderer: (list) => list.name,
  });
  return lists.indexOf(selection.value) + 1;
};

(async () => {
  const authToken = await getAuthToken();

  const trelloClient = new Trello(authToken);

  const selectedBoardId = await getSelectedBoardId(trelloClient);

  const { createdThisWeekList, movedDoneWeekList } = await moveDoneLists(
    trelloClient,
    selectedBoardId,
    confirmListPlacement,
    chooseListPlacement
  );
  if (!createdThisWeekList && !movedDoneWeekList) {
    console.log("Nothing to do.");
  } else if (movedDoneWeekList) {
    console.log("Moved last week's done list.");
  } else {
    console.log("No last week done list, created new one.");
  }

  const consolidatedLists = await maybeConsolidateLists(
    trelloClient,
    selectedBoardId
  );
  if (consolidatedLists.length === 0) {
    console.log("No done lists to consolidate.");
  } else {
    console.log("Consolidated the following done lists:");
    consolidatedLists.forEach((name) => console.log(name));
  }
})();
