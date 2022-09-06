import { Button, Divider, Input, Popconfirm } from "antd";
import React, { useState, useEffect } from "react";
import { GameAddress } from "../components";
import { useHistory } from "react-router-dom";

export default function Home({ address, mainnetProvider, tx, readContracts, writeContracts, DEBUG }) {
  const [activeGame, setActiveGame] = useState();
  const [joinAddress, setJoinAddress] = useState();

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

  const joinGame = async () => {
    const entryFee = await readContracts.Morra.entryFee();
    try {
      const txCur = await tx(writeContracts.Morra.joinGame(joinAddress, { value: entryFee }));
      await txCur.wait();
      const activeGamefromContract = await readContracts.Morra.activeGame(address);
      if (DEBUG) console.log("activeGamefromContract: ", activeGamefromContract);
      history.push("/game/" + joinAddress);
    } catch (e) {
      console.log("Failed to join game", e);
    }
  };
  const createGame = async () => {
    const entryFee = await readContracts.Morra.entryFee();
    try {
      const txCur = await tx(writeContracts.Morra.createGame({ value: entryFee }));
      await txCur.wait();
      const activeGamefromContract = await readContracts.Morra.activeGame(address);
      if (DEBUG) console.log("activeGamefromContract: ", activeGamefromContract);
      history.push("/game/" + activeGamefromContract);
    } catch (e) {
      console.log("Failed to create game", e);
    }
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
                {activeGame === "0x0000000000000000000000000000000000000000" ? (
                  <Button style={{ marginTop: 8 }} onClick={joinGame}>
                    Join (1 MATIC)
                  </Button>
                ) : (
                  <Popconfirm
                    title="Are you sure to join this game? If you didn't finish your current game session you will lose your entry fee."
                    onConfirm={joinGame}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button style={{ marginTop: 8 }}>Join (1 MATIC)</Button>
                  </Popconfirm>
                )}
              </div>
              <Divider />
              <h2>Create new Game</h2>
              <div style={{ margin: 8 }}>
                {activeGame === "0x0000000000000000000000000000000000000000" ? (
                  <Button style={{ marginTop: 8 }} onClick={createGame}>
                    Create (1 MATIC)
                  </Button>
                ) : (
                  <Popconfirm
                    title="Are you sure to create a new game? If you didn't finish your current game session you will lose your entry fee."
                    onConfirm={createGame}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button style={{ marginTop: 8 }}>Create (1 MATIC)</Button>
                  </Popconfirm>
                )}
              </div>
              <Divider />
            </>
          </div>
        </div>
      </div>
      <div class="rounds">
        <div class="rounds-corners">
          <ul>
            <li></li>
            <li></li>
          </ul>
          <ul>
            <li></li>
            <li></li>
          </ul>
        </div>
        <div class="content">
          <p><strong>Morra</strong> is a hand game that dates back thousands of years to ancient Roman and Greek times.</p>
          <p>Each player simultaneously reveals their hand, extending any number of fingers, and calls out their guess at what the sum of all fingers shown will be.</p>
          <p>The score to each player is the maximum total minus the difference between the total guess and the real total.</p>
          <p>For example, if there are 3 players, the max total is 15 (5 for each one). If a user guesses 10 and the real total is 12, then the player gets 13 points (15 - (12-10)).</p>
          <p>The first player that get (players count * 15) points wins (or the best score after 5 rounds).</p>
          <p>Each player needs to pay an entry fee and the winner gets the pot!</p>
        </div>
      </div>
    </div>
  );
}
