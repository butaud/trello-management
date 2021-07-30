import fs from "fs";

const DB_FILE = "./data/db.json";

export enum DbKey {
  SAVED_BOARD_ID = "SAVED_BOARD_ID",
  TRELLO_APP_TOKEN = "TRELLO_APP_TOKEN",
}

const getDb = (): Record<DbKey, any> => {
  const fileContents = fs.readFileSync(DB_FILE);
  return JSON.parse(fileContents.toString());
};

const writeDb = (dbObject: Record<DbKey, any>) => {
  const contentsToWrite = JSON.stringify(dbObject);
  fs.writeFileSync(DB_FILE, contentsToWrite);
};

export const getDbValue = (key: DbKey) => {
  return getDb()[key];
};

export const setDbValue = (key: DbKey, value: any) => {
  const existingDb = getDb();
  existingDb[key] = value;
  writeDb(existingDb);
};

export const fetchOrCacheInDb = async <T>(
  key: DbKey,
  obtainValue: () => Promise<T>
): Promise<T> => {
  const existingValue = getDbValue(key) as T;
  if (existingValue) {
    return existingValue;
  }
  const newValue = await obtainValue();
  setDbValue(key, newValue);
  return newValue;
};
