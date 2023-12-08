import path from "path";

const inclusion = require("inclusion");
import {
  LlamaModel,
  LlamaContext,
  LlamaChatSession,
  Token,
  LlamaChatPromptWrapper,
} from "node-llama-cpp";

export class LlamaModelParser {
  private readonly modelDir;
  private readonly modelName;

  private modelContext;
  private readonly contextSize;
  private readonly threads;

  constructor(
    modelDir: string,
    modelName: string,
    contextSize: number,
    threads: number
  ) {
    this.modelDir = modelDir;
    this.modelName = modelName;
    this.contextSize = contextSize;
    this.threads = threads;
  }
  public async generate(inputPrefix, inputSuffix, inferenceOptions) {
    if (this.modelContext === undefined) {
      // Need to dynamic import ES module to use in our CommonJS module
      const {
        LlamaModel,
        LlamaContext,
        LlamaChatSession,
        LlamaChatPromptWrapper,
      } = await inclusion("node-llama-cpp");

      const model = new LlamaModel({
        modelPath: path.join(this.modelDir, this.modelName),
      });

      const context = new LlamaContext({
        model: model,
        contextSize: this.contextSize,
        threads: this.threads,
      });
      this.modelContext = context;
    }
    return this.run(inputPrefix, inputSuffix, inferenceOptions);
  }
  private async run(inputPrefix, inputSuffix, inferenceOptions) {
    const context = this.modelContext!;
    let options = {};

    let query = "";

    if (inputSuffix) {
      query = `<PRE> ${inputPrefix} <SUF> ${inputSuffix} <MID>`;
    } else {
      query = `${inputPrefix}`;
    }

    const queryTokens = context.encode(query);
    const res: Token[] = [];

    options = {
      temperature: inferenceOptions["temperature"],
      topK: inferenceOptions["topK"],
      topP: inferenceOptions["topP"],
      repeatPenalty: {
        lastTokens: 24,
        penalty: inferenceOptions["repeatPenalty"],
        penalizeNewLine: true,
        frequencyPenalty: 0.02,
        presencePenalty: 0.02,
      },
    };
    for await (const modelToken of context.evaluate(queryTokens, options)) {
      //console.log(modelToken);
      if (modelToken === context.getEosToken()) {
        break;
      }
      if (res.length > inferenceOptions["nPredict"]) {
        break;
      }
      res.push(modelToken);
    }
    // It's important to not concatinate the results as strings,
    // as doing so will break some characters (like some emojis)
    // that consist of multiple tokens.
    let response = context.decode(res);
    if (response.includes("<EOT>")) {
      response = response.split("<EOT>")[0];
    }
    return response;
  }
}
