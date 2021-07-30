import axios, { Method } from "axios";
import { getConfig } from "../store/config";

const BASE_URL = "https://api.trello.com/1";

interface TrelloObject {
  id: string;
}

export interface Board extends TrelloObject {
  name: string;
}

export interface List extends TrelloObject {
  name: string;
}

interface ListInternal extends List {
  pos: number;
}

export default class TrelloClient {
  private readonly appKey: string;
  private readonly authToken: string;
  private readonly verbose: boolean;

  constructor(authToken: string) {
    const config = getConfig();
    this.verbose = config.verbose;
    this.appKey = config.appKey;
    this.authToken = authToken;
  }

  private getParamsWithAuth = (params?: any) => {
    return { key: this.appKey, token: this.authToken, ...params };
  };

  private requestAuthenticated = async <T>(
    method: Method,
    path: string,
    params?: any,
    body?: any
  ): Promise<T> => {
    if (this.verbose) {
      console.log(`${method} ${path} (params=${JSON.stringify(params)})`);
    }
    return (
      await axios.request<T>({
        method,
        url: `${BASE_URL}${path}`,
        params: this.getParamsWithAuth(params),
        data: body,
      })
    ).data;
  };

  private calculatePos = async (
    boardId: string,
    index: number
  ): Promise<number> => {
    const allLists = await this.requestAuthenticated<Array<ListInternal>>(
      "GET",
      `/boards/${boardId}/lists`
    );
    if (index < 0 || index > allLists.length) {
      throw new Error("Invalid index");
    }
    if (allLists.length === 0) {
      return 65536;
    } else {
      const beforePos = allLists[index - 1]?.pos ?? 0;
      const afterPos = allLists[index]?.pos ?? allLists[index - 1]?.pos + 32768;
      return (beforePos + afterPos) / 2;
    }
  };

  getBoards = (): Promise<Array<Board>> =>
    this.requestAuthenticated<Array<Board>>("GET", "/members/me/boards", {
      fields: "name",
    });

  getLists = async (boardId: string): Promise<Array<List>> =>
    (
      await this.requestAuthenticated<Array<ListInternal>>(
        "GET",
        `/boards/${boardId}/lists`
      )
    ).sort((a, b) => a.pos - b.pos);

  createList = async (boardId: string, listName: string, index: number) => {
    const newPos = await this.calculatePos(boardId, index);
    this.requestAuthenticated<void>("POST", "/lists", {
      name: listName,
      idBoard: boardId,
      pos: newPos,
    });
  };

  moveListOnBoard = async (
    listId: string,
    boardId: string,
    newIndex: number
  ): Promise<void> => {
    const newPos = await this.calculatePos(boardId, newIndex);
    return await this.requestAuthenticated<void>("PUT", `/lists/${listId}`, {
      pos: newPos,
    });
  };

  updateListName = async (listId: string, newName: string): Promise<void> => {
    await this.requestAuthenticated<void>("PUT", `/lists/${listId}`, {
      name: newName,
    });
  };

  moveAllCards = async (
    fromListId: string,
    toListId: string,
    toBoardId: string
  ): Promise<void> => {
    await this.requestAuthenticated<void>(
      "POST",
      `/lists/${fromListId}/moveAllCards`,
      {
        idBoard: toBoardId,
        idList: toListId,
      }
    );
  };

  archiveList = async (listId: string): Promise<void> => {
    await this.requestAuthenticated<void>("PUT", `/lists/${listId}/closed`, {
      value: "true",
    });
  };
}
