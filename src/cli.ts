#!/usr/bin/env node
process.title = "pi-sam";

import { main } from "./main.js";

main(process.argv.slice(2));
