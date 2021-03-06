/*
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the Apache License Version 2.0.
 *
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2019 Datadog, Inc.
 */

import { datadogDirectory, getWrapperText, writeHandlers, writeWrapperFunction } from "./wrapper";

import { RuntimeType } from "./layer";
import fs from "fs";
import mock from "mock-fs";

describe("getWrapperText", () => {
  it("renders the python template correctly", () => {
    const wrapperText = getWrapperText({
      name: "my-lambda",
      type: RuntimeType.PYTHON,
      handler: {
        name: "",
        package: {} as any,
        handler: "mydir/func.myhandler",
      },
    });
    expect(wrapperText).toMatchInlineSnapshot(`
            Object {
              "method": "myhandler",
              "text": "from datadog_lambda.wrapper import datadog_lambda_wrapper
            from mydir.func import myhandler as myhandler_impl
            myhandler = datadog_lambda_wrapper(myhandler_impl)",
            }
        `);
  });
  it("renders the node template correctly", () => {
    const wrapperText = getWrapperText({
      name: "my-lambda",
      type: RuntimeType.NODE,
      handler: {
        name: "",
        package: {} as any,
        handler: "my.myhandler",
      },
    });
    expect(wrapperText).toMatchInlineSnapshot(`
            Object {
              "method": "myhandler",
              "text": "const { datadog } = require(\\"datadog-lambda-js\\");
            const original = require(\\"../my\\");
            module.exports.myhandler = datadog(original.myhandler);",
            }
        `);
  });
  it("renders the node ts template correctly", () => {
    const wrapperText = getWrapperText({
      name: "my-lambda",
      type: RuntimeType.NODE_TS,
      handler: {
        name: "",
        package: {} as any,
        handler: "my.myhandler",
      },
    });
    expect(wrapperText).toMatchInlineSnapshot(`
      Object {
        "method": "myhandler",
        "text": "/* tslint:disable */
      /* eslint-disable */
      const { datadog } = require(\\"datadog-lambda-js\\") as any;
      import * as original from \\"../my\\";
      export const myhandler = datadog(original.myhandler);",
      }
    `);
  });
});

describe("writeWrapperFunction", () => {
  beforeAll(() => {
    mock({
      [datadogDirectory]: {},
    });
  });

  afterAll(() => {
    mock.restore();
  });
  it("writes out node files to a .js file", async () => {
    await writeWrapperFunction(
      {
        name: "my-lambda",
        type: RuntimeType.NODE,
        handler: {
          name: "my-lambda",
          package: {} as any,
          handler: "mydir/func.myhandler",
        },
      },
      "my-text",
    );
    expect(fs.existsSync(`${datadogDirectory}/my-lambda.js`)).toBeTruthy();
  });
  it("writes out python files to a .py file", async () => {
    await writeWrapperFunction(
      {
        name: "my-lambda",
        type: RuntimeType.PYTHON,
        handler: {
          name: "my-lambda",
          package: {} as any,
          handler: "mydir/func.myhandler",
        },
      },
      "my-text",
    );
    expect(fs.existsSync(`${datadogDirectory}/my-lambda.py`)).toBeTruthy();
  });
});

describe("writeHandlers", () => {
  afterAll(() => {
    mock.restore();
  });

  it("adds created files to the includes list", async () => {
    mock({});
    const service = {} as any;
    await writeHandlers(service, [
      {
        name: "my-lambda",
        type: RuntimeType.PYTHON,
        handler: {
          name: "my-lambda",
          package: {} as any,
          handler: "mydir/func.myhandler",
        },
      },
    ]);
    expect(service).toEqual({
      package: {
        include: [`${datadogDirectory}/my-lambda.py`, `${datadogDirectory}/**`],
      },
    });
  });

  it("adds datadog_handlers to include list by default", async () => {
    mock({});
    const service = {
      package: {
        include: [],
      },
    } as any;
    await writeHandlers(service, []);
    expect(service).toEqual({
      package: {
        include: [`${datadogDirectory}/**`],
      },
    });
  });

  it("cleans up existing datadogDirectory", async () => {
    mock({
      [datadogDirectory]: {
        "unused-file": "some-value",
      },
    });
    const service = {} as any;
    await writeHandlers(service, []);
    expect(fs.existsSync(`${datadogDirectory}/unused-file`)).toBeFalsy();
  });

  it("ignores handlers with poorly formatted names", async () => {
    mock({});
    const service = {} as any;
    await writeHandlers(service, [
      {
        name: "my-lambda",
        type: RuntimeType.PYTHON,
        handler: {
          name: "my-lambda",

          package: {} as any,
          handler: "mydir-myhandler",
        },
      },
    ]);
    expect(fs.existsSync(`${datadogDirectory}/my-lambda.py`)).toBeFalsy();
  });

  it("creates well formatted handlers", async () => {
    mock({});
    const service = {} as any;
    await writeHandlers(service, [
      {
        name: "my-lambda",
        type: RuntimeType.PYTHON,
        handler: {
          name: "my-lambda",

          package: {} as any,
          handler: "mydir.myhandler",
        },
      },
    ]);
    expect(fs.existsSync(`${datadogDirectory}/my-lambda.py`)).toBeTruthy();
  });
  it("uses the typescript template when the handler file is ts", async () => {
    mock({
      "mylambda.ts": "",
    });
    const service = {} as any;
    await writeHandlers(service, [
      {
        name: "my-lambda",
        type: RuntimeType.NODE,
        handler: {
          name: "my-lambda",

          package: {} as any,
          handler: "mylambda.myhandler",
        },
      },
    ]);
    expect(fs.existsSync(`${datadogDirectory}/my-lambda.ts`)).toBeTruthy();
  });
});
