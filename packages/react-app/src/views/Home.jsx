import { Button, Divider, Input } from "antd";
import React, { useState } from "react";
import { GameAddress } from "../components";
import { useContractReader } from "eth-hooks";

export default function Home({ address, mainnetProvider, tx, readContracts, writeContracts, DEBUG }) {
  const activeGame = useContractReader(readContracts, "Morra", "activeGame", [address]);
  console.log("activeGame: ", activeGame);

  const [joinAddress, setJoinAddress] = useState();

  const txnUpdate = update => {
    console.log("📡 Transaction Update:", update);
    if (update && (update.status === "confirmed" || update.status === 1)) {
      console.log(" 🍾 Transaction " + update.hash + " finished!");
      console.log(
        " ⛽️ " +
          update.gasUsed +
          "/" +
          (update.gasLimit || update.gas) +
          " @ " +
          parseFloat(update.gasPrice) / 1000000000 +
          " gwei",
      );
    }
  };
  const logTxn = async result => {
    console.log("awaiting metamask/web3 confirm result...", result);
    console.log(await result);
  };

  const joinGame = async () => {
    const result = tx(writeContracts.Morra.joinGame(joinAddress), txnUpdate);
    await logTxn(result);
  };
  const createGame = async () => {
    const result = tx(writeContracts.Morra.createGame(), txnUpdate);
    await logTxn(result);
  };

  return (
    <div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 500, margin: "auto", marginTop: 64 }}>
        <h2>Play Game</h2>
        {activeGame === "0x0000000000000000000000000000000000000000" ? (
          <h3>-</h3>
        ) : (
          <>
            <GameAddress
              address={activeGame}
              ensProvider={mainnetProvider}
              fontSize={18}
              href={"/game/" + activeGame}
            />
            <Divider />
          </>
        )}
        <Divider />
        <>
          <h2>Join Game</h2>
          <div style={{ margin: 8 }}>
            <Input
              placeholder="Game Address"
              style={{ textAlign: "center" }}
              onChange={e => {
                setJoinAddress(e.target.value);
              }}
            />
            <Button style={{ marginTop: 8 }} onClick={joinGame}>
              Join
            </Button>
          </div>
          <Divider />
          <h2>Create new Game</h2>
          <div style={{ margin: 8 }}>
            <Button style={{ marginTop: 8 }} onClick={createGame}>
              Create
            </Button>
          </div>
          <Divider />
        </>
      </div>
    </div>
  );
}
