const yRemoteSelectionStyle = (clientID: string, color: string) => {
  return `.yRemoteSelection-${clientID} 
      { background-color: ${color}; opacity: 0.5;} `;
};

const yRemoteSelectionHeadStyle = (clientID: string, color: string) => {
  return `.yRemoteSelectionHead-${clientID} {  
          position: absolute;
          border-left: ${color} solid 2px;
          height: 100%;
          box-sizing: border-box;}`;
};

const yRemoteSelectionHeadHoverStyle = (
  clientID: string,
  color: string,
  name: string
) => {
  return `.yRemoteSelectionHead-${clientID}::after { 
          display: inline-block;
          content: "${name}";
          border-radius: 1px;
          background-color: ${color}; 
          box-shadow: 0 0 0 2px ${color};
          border: 1px solid ${color};
          // color: white;
          opacity: 1;
          transform: translate(0, -140%);
          line-height: 0.7rem;
          font-size: small;
          padding: 0 2px 0 2px;
          font-weight: bold;
          }`;
};

const added = new Set<string>();

export function addAwarenessStyle(
  clientID: string,
  color: string,
  name: string
) {
  if (added.has(clientID)) return;
  added.add(clientID);
  const styles = document.createElement("style");
  styles.append(yRemoteSelectionStyle(clientID, color));
  styles.append(yRemoteSelectionHeadStyle(clientID, color));
  styles.append(yRemoteSelectionHeadHoverStyle(clientID, color, name));
  document.head.append(styles);
}
