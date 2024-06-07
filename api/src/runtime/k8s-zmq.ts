import crypto from "crypto";
import * as zmq from "zeromq";
import { v4 as uuidv4 } from "uuid";

function serializeMsg(msg, key) {
  // return a list of message parts
  // 4. header
  let part4 = JSON.stringify(msg.header);
  // 5. parent header
  let part5 = JSON.stringify({});
  // 6. meta data
  let part6 = JSON.stringify({});
  // 7. content
  let part7 = JSON.stringify(msg.content);

  return [
    // 1. the id
    msg.header.msg_id,
    // 2. "<IDS|MSG>"
    "<IDS|MSG>",
    // 3. HMAC
    // "",
    crypto
      .createHmac("sha256", key)
      .update(part4)
      .update(part5)
      .update(part6)
      .update(part7)
      .digest("hex"),
    part4,
    part5,
    part6,
    part7,
    // 8. extra raw buffers]
    // I'm not sending this, because iracket crashes on this
    // JSON.stringify({}),
  ];
}

function deserializeMsg(frames, key: string | null = null) {
  var i = 0;
  var idents: any[] = [];
  for (i = 0; i < frames.length; i++) {
    var frame = frames[i];
    // console.log(i);
    // console.log(toJSON(frame));
    if (frame.toString() === "<IDS|MSG>") {
      break;
    }
    idents.push(frame);
  }
  if (frames.length - i < 5) {
    console.log("MESSAGE: DECODE: Not enough message frames", frames);
    return null;
  }

  if (frames[i].toString() !== "<IDS|MSG>") {
    console.log("MESSAGE: DECODE: Missing delimiter", frames);
    return null;
  }

  if (key) {
    var obtainedSignature = frames[i + 1].toString();

    var hmac = crypto.createHmac("sha256", key);
    hmac.update(frames[i + 2]);
    hmac.update(frames[i + 3]);
    hmac.update(frames[i + 4]);
    hmac.update(frames[i + 5]);
    var expectedSignature = hmac.digest("hex");

    if (expectedSignature !== obtainedSignature) {
      console.log(
        "MESSAGE: DECODE: Incorrect message signature:",
        "Obtained = " + obtainedSignature,
        "Expected = " + expectedSignature
      );
      return null;
    }
  }

  function toJSON(value) {
    return JSON.parse(value.toString());
  }

  var message = {
    idents: idents,
    header: toJSON(frames[i + 2]),
    parent_header: toJSON(frames[i + 3]),
    content: toJSON(frames[i + 5]),
    metadata: toJSON(frames[i + 4]),
    buffers: Array.prototype.slice.apply(frames, [i + 6]),
  };

  return message;
}

function constructMessage({ msg_type, content = {}, msg_id = uuidv4() }) {
  // TODO I should probably switch to Typescript just to avoid writing such checks
  if (!msg_type) {
    throw new Error("msg_type is undefined");
  }
  return {
    header: {
      msg_id: msg_id,
      msg_type: msg_type,
      session: uuidv4(),
      username: "dummy_user",
      date: new Date().toISOString(),
      version: "5.0",
    },
    parent_header: {},
    metadata: {},
    buffers: [],
    content: content,
  };
}

function constructExecuteRequest({ code, msg_id, cp = {} }) {
  if (!code || !msg_id) {
    throw new Error("Must provide code and msg_id");
  }
  return constructMessage({
    msg_type: "execute_request",
    msg_id,
    content: {
      // Source code to be executed by the kernel, one or more lines.
      code,
      cp,
      // FIXME if this is true, no result is returned!
      silent: false,
      store_history: true,
      // XXX this does not seem to be used
      user_expressions: {
        x: "3+4",
      },
      allow_stdin: false,
      stop_on_error: false,
    },
  });
}

const spec = {
  shell_port: 55692,
  iopub_port: 55693,
  stdin_port: 55694,
  control_port: 55695,
  hb_port: 55696,
  key: "412d24d7-baca5d46b674d910851edd2f",
};

export class ZmqWire {
  shell: zmq.Dealer;
  control: zmq.Dealer;
  iopub: zmq.Subscriber;

  constructor(url: string) {
    // Pub/Sub Router/Dealer
    this.shell = new zmq.Dealer();
    this.shell.connect(`tcp://${url}:${spec.shell_port}`);
    // FIXME this is not actually connected. I need to check the real status
    // There does not seem to have any method to check connection status
    console.log("connected to shell port");

    console.log("connecting to control port ");
    this.control = new zmq.Dealer();
    this.control.connect(`tcp://${url}:${spec.control_port}`);
    this.iopub = new zmq.Subscriber();
    console.log("connecting IOPub");
    this.iopub.connect(`tcp://${url}:${spec.iopub_port}`);
    this.iopub.subscribe();
  }

  async listenShell(handler: (msgs) => void) {
    // shell channel
    for await (const [...frames] of this.shell) {
      let msgs = deserializeMsg(frames, spec.key);
      if (msgs === null) continue;
      handler(msgs);
    }
    // control channel
    for await (const [...frames] of this.control) {
      let msgs = deserializeMsg(frames, spec.key);
      // FIXME for now, just use the onshell callback
      handler(msgs);
    }
  }
  async listenIOPub(handler: (topic, msgs) => void) {
    for await (const [topic, ...frames] of this.iopub) {
      let msgs = deserializeMsg(frames, spec.key);
      if (msgs === null) continue;
      handler(topic.toString(), msgs);
    }
  }

  // Send code to kernel. Return the ID of the execute_request
  // The front-end will listen to IOPub and display result accordingly based on
  // this ID.
  sendShellMessage(msg) {
    // bind zeromq socket to the ports
    console.log("sending shell mesasge ..");
    // console.log(msg);
    // FIXME how to receive the message?
    //   sock.on("message", (msg) => {
    //     console.log("sock on:", msg);
    //   });
    // FIXME I probably need to wait until the server is started
    // sock.send(msg);
    // FIXME Error: Socket temporarily unavailable
    this.shell.send(serializeMsg(msg, spec.key));
  }
  sendControlMessage(msg) {
    this.control.send(serializeMsg(msg, spec.key));
  }
  runCode({ code, msg_id }: { code: string; msg_id: string }) {
    this.sendShellMessage(
      constructExecuteRequest({
        code,
        msg_id,
      })
    );
  }
  requestKernelStatus() {
    this.sendShellMessage(
      constructMessage({ msg_type: "kernel_info_request" })
    );
  }
  interrupt() {
    this.sendControlMessage(
      constructMessage({ msg_type: "interrupt_request" })
    );
  }
}
