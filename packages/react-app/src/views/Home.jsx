import { Button, Divider, Input } from "antd";
import React, { useState, useEffect } from "react";
import { GameAddress } from "../components";
import { useHistory } from "react-router-dom";

export default function Home({ address, mainnetProvider, tx, readContracts, writeContracts, DEBUG }) {
  const [activeGame, setActiveGame] = useState();

  const history = useHistory();

  useEffect(() => {
    const updateActiveGame = async () => {
      if (readContracts.Morra) {
        const activeGamefromContract = await readContracts.Morra.activeGame(address);
        if (DEBUG) console.log("activeGamefromContract: ", activeGamefromContract);
        setActiveGame(activeGamefromContract);
      }
    };
    updateActiveGame();
  }, [DEBUG, readContracts.Morra, address]);

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
    history.push("/game/" + joinAddress);
  };
  const createGame = async () => {
    const result = tx(writeContracts.Morra.createGame(), txnUpdate);
    await logTxn(result);
    const activeGamefromContract = await readContracts.Morra.activeGame(address);
    if (DEBUG) console.log("activeGamefromContract: ", activeGamefromContract);
    history.push("/game/" + activeGamefromContract);
  };

  return (
    <div class="container">
      <div class="main">
        <div class="inside-main">
          <div class="inside-inside-main">
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
              <div style={{ margin: "0 auto", width: "80%" }}>
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
      </div>
      <div class="rounds">
        <div class="rounds-corners">
            <ul >
                <li></li>
                <li></li>
            </ul>
            <ul >
                <li></li>
                <li></li>
            </ul>
        </div>
        <div class="content">
          <p><strong>Morra</strong> is a hand game that dates back thousands of years to ancient Roman and Greek times.</p>
          <p>Each player simultaneously reveals their hand, extending any number of fingers, and calls out their guess at what the sum of all fingers shown will be.</p>
          <p>The score to each player is the maximum total minus the difference between the total guess and the real total.</p>
          <p>For example, if there are 3 players, the max total is 15 (5 for each one). If a user guesses 10 and the real total is 12, then the player gets 13 points (15 - (12-10)).</p>
          <p>The first player that get (players count * 5 * 3) points wins or the best score after 5 rounds.</p>
        </div>
      </div>
    </div>
  );
}
