export type PodResult = {
  exec_count?: number;
  data: {
    // type: "stream_stdout" | "stream_stderr" | "display_data" | "execute_result";
    type: string;
    html?: string;
    text?: string;
    image?: string;
  }[];
  running?: boolean;
  lastExecutedAt?: number;
  error?: { ename: string; evalue: string; stacktrace: string[] } | null;
};

export type RuntimeInfo = {
  status?: string;
  wsStatus?: string;
};
