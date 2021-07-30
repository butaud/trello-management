import fs from "fs";

const CONFIG_FILE = "./config/trello.json";

export const getConfig = () => {
  const fileContents = fs.readFileSync(CONFIG_FILE);
  return JSON.parse(fileContents.toString());
};
