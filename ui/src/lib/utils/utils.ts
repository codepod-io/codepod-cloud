import { customAlphabet } from "nanoid";
import { lowercase, numbers } from "nanoid-dictionary";

export function myassert(condition: any, msg?: string): asserts condition {
  if (!condition) {
    throw new Error(msg);
  }
}

// FIXME performance for reading this from localstorage
export const getAuthHeaders = () => {
  let authToken = localStorage.getItem("token") || null;
  if (!authToken) return null;
  return {
    authorization: `Bearer ${authToken}`,
  };
};

export function timeDifference(current: Date, previous: Date) {
  const msPerMinute = 60 * 1000;
  const msPerHour = msPerMinute * 60;
  const msPerDay = msPerHour * 24;
  const msPerMonth = msPerDay * 30;
  const msPerYear = msPerDay * 365;
  const elapsed = current.getTime() - previous.getTime();

  // if (elapsed < 0) {
  //   throw new Error(`current time is less than previous time ${elapsed}`);
  // }

  if (elapsed < msPerMinute) {
    return Math.round(elapsed / 1000) + " sec";
  } else if (elapsed < msPerHour) {
    return Math.round(elapsed / msPerMinute) + " min";
  } else if (elapsed < msPerDay) {
    return Math.round(elapsed / msPerHour) + " hours";
  } else if (elapsed < msPerMonth) {
    return Math.round(elapsed / msPerDay) + " days";
  } else if (elapsed < msPerYear) {
    return Math.round(elapsed / msPerMonth) + " months";
  } else {
    return Math.round(elapsed / msPerYear) + " years";
  }
}

// pretty print the time difference
export function prettyPrintTime(d) {
  let year = d.getUTCFullYear() - 1970;
  let month = d.getUTCMonth();
  let day = d.getUTCDate() - 1;
  let hour = d.getUTCHours();
  let minute = d.getUTCMinutes();
  let second = d.getUTCSeconds();
  return (
    (year > 0 ? year + "y" : "") +
    (month > 0 ? month + "m" : "") +
    (day > 0 ? day + "d" : "") +
    (hour > 0 ? hour + "h" : "") +
    (minute >= 0 ? minute + "m" : "") +
    (second > 0 ? second + "s" : "")
  );
}

export function prettyPrintBytes(bytes: number) {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// cpu: '19612n'
export function prettyPrintCPU(cpu: string) {
  // 19612n means nano vCPU
  // 19.612m means milli vCPU
  // 0.019612 means vCPU
  // 19612n -> 19.612m -> 0.019612vCPU
  if (cpu.endsWith("n")) {
    let n = parseFloat(cpu.slice(0, -1));
    let m = n / 1000000;
    let v = m / 1000;
    return `${v.toFixed(2)}`;
  } else if (cpu.endsWith("m")) {
    let m = parseFloat(cpu.slice(0, -1));
    let v = m / 1000;
    return `${v.toFixed(2)}`;
  } else {
    return `${parseFloat(cpu).toFixed(2)}`;
  }
}

// memory: '48440Ki'
export function prettyPrintMemory(memory: string) {
  // 48440Ki means Kib
  // 48.44Mi means Mib
  // 0.04844Gi means Gib
  // 48440Ki -> 48.44Mi -> 0.04844Gi
  if (memory.endsWith("Ki")) {
    let ki = parseFloat(memory.slice(0, -2));
    let mi = ki / 1024;
    return `${mi.toFixed(2)}`;
  } else if (memory.endsWith("Mi")) {
    let mi = parseFloat(memory.slice(0, -2));
    return `${mi.toFixed(2)}`;
  } else if (memory.endsWith("Gi")) {
    let gi = parseFloat(memory.slice(0, -2));
    let mi = gi * 1024;
    return `${gi.toFixed(2)}`;
  }
}

export function getUpTime(startedAt: string) {
  let d1 = new Date(parseInt(startedAt));
  let now = new Date();
  let diff = new Date(now.getTime() - d1.getTime());
  let prettyTime = prettyPrintTime(diff);
  return prettyTime;
}

export const myNanoId = customAlphabet(lowercase + numbers, 20);

const yRemoteSelectionStyle = (clientID: string, color: string) => {
  return `.yRemoteSelection-${clientID} 
    { background-color: ${color}; opacity: 0.5;} `;
};

const yRemoteSelectionHeadStyle = (clientID: string, color: string) => {
  return `.yRemoteSelectionHead-${clientID} {  
        position: absolute;
        border-left: ${color} solid 2px;
        border-top: ${color} solid 2px;
        border-bottom: ${color} solid 2px;
        height: 100%;
        box-sizing: border-box;}`;
};

const yRemoteSelectionHeadHoverStyle = (
  clientID: string,
  color: string,
  name: string
) => {
  return `.yRemoteSelectionHead-${clientID}:hover::after { 
        content: "${name}"; 
        background-color: ${color}; 
        box-shadow: 0 0 0 2px ${color};
        border: 1px solid ${color};
        color: white;
        opacity: 1; }`;
};

export function addAwarenessStyle(
  clientID: string,
  color: string,
  name: string
) {
  const styles = document.createElement("style");
  styles.append(yRemoteSelectionStyle(clientID, color));
  styles.append(yRemoteSelectionHeadStyle(clientID, color));
  styles.append(yRemoteSelectionHeadHoverStyle(clientID, color, name));
  document.head.append(styles);
}
