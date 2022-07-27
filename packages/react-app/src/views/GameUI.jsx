import { SyncOutlined } from "@ant-design/icons";
import { utils } from "ethers";
import { Button, Card, DatePicker, Divider, Input, Row, Col, Radio, notification, InputNumber, Table } from "antd";
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Address, Balance, Events } from "../components";
import { useEventListener } from "eth-hooks/events/useEventListener";
import humanizeDuration from "humanize-duration";
import Text from "antd/lib/typography/Text";
import { useContractReader } from "eth-hooks";

const { ethers } = require("ethers");

export default function GameUI({
  address,
  mainnetProvider,
  localProvider,
  tx,
  readContracts,
  writeContracts,
  DEBUG,
}) {
  // Possible Game States:
  const UIState = {
    NoGame: -1, // Show join / host options
    JoinPhase: 0,
    CommitPhase: 1,
    RevealPhase: 2,
    ResultPhase: 3,
  };
  const GameResult = {
    None: -1, // Show join / host options
    P1Win: 0,
    P2Win: 1,
    Draw: 2,
  };

  const activeGame = useParams().game;

  console.log("activeGame: ", activeGame);

  const [joinAddress, setJoinAddress] = useState();
  const [commitChoice, setCommitChoice] = useState();
  const [total, setTotal] = useState();
  const [commitSalt, setCommitSalt] = useState("");


  const playerRevealEvents = useEventListener(readContracts, "Morra", "PlayerReveal", localProvider, 12686990);

  console.log("playerRevealEvents: ", playerRevealEvents);

  const playerRevealColumns = [
    {
      title: "Round",
      dataIndex: "round",
      render: (text, record, index) => {
        return record.args.round.toString();
      },
    },
    {
      title: "Player",
      dataIndex: "player",
      render: (text, record, index) => {
        return <Address noCopy={true} value={record.args.player} ensProvider={mainnetProvider} fontSize={16} />;
      },
    },
    {
      title: "#",
      dataIndex: "number",
      render: (text, record, index) => {
        return record.args.number;
      },
    },
    {
      title: "Total",
      dataIndex: "total",
      render: (text, record, index) => {
        return record.args.total.toString();
      },
    },
  ];

/*
  const [activeGameData, setActiveGameData] = useState();

  useEffect(() => {
    const updateActiveGameData = async () => {
      if (readContracts.Morra) {
        // const activeGamefromContract = await readContracts.Morra.activeGame(address);
        const activeGameDatafromContract = useContractReader(readContracts, "Morra", "getActiveGameData", [address]);
        console.log("activeGameDatafromContract: ", activeGameDatafromContract);
        setActiveGameData(activeGameDatafromContract);
      }
    };
    updateActiveGameData();
  }, [DEBUG, readContracts.Morra, address]);
*/

  function getRandomString(bytes) {
    const randomValues = new Uint8Array(bytes);
    crypto.getRandomValues(randomValues);
    return Array.from(randomValues).map(intToHex).join('');
  }

  function intToHex(nr) {
    return nr.toString(16).padStart(2, '0');
  }

  const activeGameData = useContractReader(readContracts, "Morra", "getActiveGameData", [address]);
  console.log("activeGameData: ", activeGameData);

  const [players, setPlayers] = useState([]);

  useEffect(() => {
    const updatePlayers = async () => {
      if (readContracts.Morra) {
        const playersFromContract = await readContracts.Morra.getPlayersOnGame(activeGame);
        console.log("playersFromContract: ", playersFromContract);
        const playersWithData = [];
        for (let i = 0; i < playersFromContract.length; i++) {
          const playerGameData = await readContracts.Morra.getActiveGameData(playersFromContract[i]);
          playersWithData.push({ address: playersFromContract[i], gameData: playerGameData });
        }
        console.log("playersWithData: ", playersWithData);
        setPlayers(playersWithData);
      }
    };
    updatePlayers();
  }, [DEBUG, readContracts.Morra, activeGame, activeGameData]);

  let timeLeft;
  let isPlayer1;
  let playerHasCommitted = false;
  let playerHasRevealed = false;
  let gameResult = GameResult.None;
  let currentUIState = UIState.NoGame;
  if (activeGameData) {
    const { initialized, gameState } = activeGameData;
    if (initialized) {
      currentUIState = gameState;
      gameResult = activeGameData.gameResult;
    }
    isPlayer1 = address === activeGameData.player1;
    playerHasCommitted = activeGameData.commited;
    playerHasRevealed = activeGameData.revealed;
  }
  let gameStateMessage = "";
  if (currentUIState === UIState.JoinPhase) gameStateMessage = "Waiting for players to join";
  if (currentUIState === UIState.CommitPhase) {
    gameStateMessage = playerHasCommitted ? "Waiting for other player to play" : "Waiting for you to play";
  }
  if (currentUIState === UIState.RevealPhase) {
    gameStateMessage = playerHasRevealed ? "Waiting for other player to reveal" : "Commited. Waiting for you to reveal";
    const timestamp = Math.round(Date.now() / 1000); //TODO Change to use block timestamp
    timeLeft = activeGameData.revealDeadline > timestamp ? activeGameData.revealDeadline - timestamp : 0;
    console.log("TIMELEFT", timeLeft, typeof timeLeft);
  }
  let winners;
  if (currentUIState === UIState.ResultPhase) {
    console.log("players: ", players);
    const playersWith3Points = players.filter(function (player) {
      return player.gameData.points.toNumber() === 3;
    });
    console.log("playersWith3Points: ", playersWith3Points);
    if (playersWith3Points.length > 0) {
      winners = playersWith3Points.map(function (player) {
        return player.address;
      });
    } else {
      const maxPoints = players.map(function (player) {
        return player.gameData.points.toNumber();
      });
      const playersWithMaxPoints = players.filter(function (player) {
        return player.gameData.points.toNumber() === maxPoints;
      });
      winners =
        playersWithMaxPoints &&
        playersWithMaxPoints.map(function (player) {
          return player.address;
        });
    }

    console.log("winners: ", winners);

    if (winners.includes(address)) {
      gameStateMessage = "🏆 You won! 🎉🎉";
    } else {
      gameStateMessage = "😞 You lost!";
    }
  }

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
  const startGame = async () => {
    const result = tx(writeContracts.Morra.startGame(activeGame), txnUpdate);
    await logTxn(result);
  };
  const commit = async () => {
    if (!commitChoice) {
      notification["warning"]({
        message: "No choice selected",
        description: "Please choose a number between 0 and 5",
      });
      return;
    }
    if (!total) {
      notification["warning"]({
        message: "No total guess",
        description: "Please complete your total",
      });
      return;
    }

    const password = getRandomString(10);
    setCommitSalt(password);

    const hash = ethers.utils.solidityKeccak256(["uint8", "uint256", "string"], [commitChoice, total, password]);

    const result = tx(writeContracts.Morra.commit(hash), txnUpdate);
    await logTxn(result);
  };
  const reveal = async () => {
    if (!commitChoice) {
      notification["warning"]({
        message: "No choice selected",
        description: "Please choose rock, paper or scissors",
      });
      return;
    }
    if (!total) {
      notification["warning"]({
        message: "No total guess",
        description: "Please complete your total",
      });
      return;
    }
    const result = tx(writeContracts.Morra.reveal(commitChoice, total, commitSalt), txnUpdate);
    await logTxn(result);
  };
  const finishRound = async () => {
    const result = tx(writeContracts.Morra.determineWinnersAfterRevealTimeout(activeGame), txnUpdate);
    await logTxn(result);
  };
  const leaveGame = async () => {
    const result = tx(writeContracts.Morra.leaveGame(), txnUpdate);
    await logTxn(result);
  };

  const renderChoice = reveal => {
    const rockHash = "0x10977e4d68108d418408bc9310b60fc6d0a750c63ccef42cfb0ead23ab73d102";
    const paperHash = "0xea923ca2cdda6b54f4fb2bf6a063e5a59a6369ca4c4ae2c4ce02a147b3036a21";
    const scissorsHash = "0x389a2d4e358d901bfdf22245f32b4b0a401cc16a4b92155a2ee5da98273dad9a";
    let choice;
    let emoji;
    if (reveal === rockHash) {
      choice = "rock";
      emoji = "✊";
    } else if (reveal === paperHash) {
      choice = "paper";
      emoji = "🖐";
    } else if (reveal === scissorsHash) {
      choice = "scissors";
      emoji = "✌";
    } else return <></>;
    return (
      <Radio.Button value={choice} style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}>
        {emoji}
        <div style={{ fontSize: "20px", margin: "20px 0" }}>{`"${choice}"`}</div>
      </Radio.Button>
    );
  };

  const handleChangeTotal = value => {
    console.log("Total: ", value);
    setTotal(value);
  };

  return (
    <div>
      <div style={{ float: "left", width: 300, border: "1px solid #cccccc", marginLeft: 30 }}>
        {players && players.map(function(player, i) {
          return (
            <Row
              span={12}
              style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderBottom: "1px solid #cccccc", paddingBottom: 20 }}
            >
              <h2 style={{ marginTop: 16 }}>Player {i+1} - {player.gameData.points.toString()} points</h2>
              <Address address={player.address} ensProvider={mainnetProvider} fontSize={16} />
              {currentUIState === UIState.CommitPhase && player.gameData.commited && (
                <span class="commited">Played</span>
              )}
              {currentUIState === UIState.CommitPhase && !player.gameData.commited && (
                <span class="uncommited">Waiting to play</span>
              )}
              {currentUIState === UIState.RevealPhase && player.gameData.revealed && (
                <span class="revealed">Revealed</span>
              )}
              {currentUIState === UIState.RevealPhase && !player.gameData.revealed && (
                <span class="unrevealed">Waiting to reveal</span>
              )}
            </Row>
          )
        })}
      </div>
      <div style={{ float: "right", width: 400, border: "1px solid #cccccc", marginRight: 30 }}>
        <h2>Reveals</h2>
        <Table
          dataSource={playerRevealEvents.filter(event => event.args.gameHash === activeGame)}
          columns={playerRevealColumns}
          pagination={{ pageSize: 20 }}
        />
      </div>
      <div style={{ border: "1px solid #cccccc", padding: 16, width: 500, margin: "auto", marginTop: 64 }}>
        <h2>Active Game</h2>
        {activeGame === "0x0000000000000000000000000000000000000000" || !activeGameData ? (
          <h3>-</h3>
        ) : (
          <>
            <Address address={activeGame} ensProvider={mainnetProvider} fontSize={18} />
          </>
        )}
        <Divider />
        {currentUIState === UIState.NoGame && (
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
        )}
        {currentUIState === UIState.JoinPhase && (
          <>
            <h2>Game State</h2>
            <h1>{gameStateMessage}</h1>

            <h3>Send them the game address above so they can join</h3>

            {activeGameData.creator == address && (
              <div style={{ margin: 8 }}>
                <Button style={{ marginTop: 8 }} onClick={startGame}>
                  Start
                </Button>
              </div>
            )}
          </>
        )}
        {currentUIState === UIState.CommitPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Your Points: {activeGameData.points.toString()}</h2>
              <h2>Game State</h2>
              <h2>Round {activeGameData.round.toString()}</h2>
              <h1>{gameStateMessage}</h1>
            </div>
            {!playerHasCommitted && (
              <>
                <Divider />
                <div style={{ margin: 8 }}>
                  <Radio.Group buttonStyle="solid">
                    <Radio.Button
                      value="0"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      ✊<div style={{ fontSize: "20px", margin: "20px 0" }}>0</div>
                    </Radio.Button>
                    <Radio.Button
                      value="1"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      ☝<div style={{ fontSize: "20px", margin: "20px 0" }}>1</div>
                    </Radio.Button>
                    <Radio.Button
                      value="2"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      ✌<div style={{ fontSize: "20px", margin: "20px 0" }}>2</div>
                    </Radio.Button>
                    <Radio.Button
                      value="3"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      🤟<div style={{ fontSize: "20px", margin: "20px 0" }}>3</div>
                    </Radio.Button>
                    <Radio.Button
                      value="4"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      ✌✌<div style={{ fontSize: "20px", margin: "20px 0" }}>4</div>
                    </Radio.Button>
                    <Radio.Button
                      value="5"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                      onChange={e => setCommitChoice(e.target.value)}
                    >
                      🖐<div style={{ fontSize: "20px", margin: "20px 0" }}>5</div>
                    </Radio.Button>
                  </Radio.Group>
                  <div style={{ margin: 20 }}>
                    <label style={{ fontSize: 20, marginRight: 10 }}>Your total guess:</label>
                    <InputNumber
                      value={total}
                      min="0"
                      max="100"
                      step="1"
                      placeholder="Total"
                      onChange={handleChangeTotal}
                    />
                  </div>
                  <div>
                    <Button type="primary" style={{ marginTop: 8 }} onClick={commit}>
                      Play
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        {currentUIState === UIState.RevealPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Game State</h2>
              <h2>Round {activeGameData.round.toString()}</h2>
              <h1>{gameStateMessage}</h1>
            </div>
            <Divider />
            <div style={{ margin: 8 }}>
              {!playerHasRevealed ? (
                <>
                  <h2>Reveal</h2>
                  <Radio.Group buttonStyle="solid" value={commitChoice}>
                    <Radio.Button
                      value="0"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      ✊<div style={{ fontSize: "20px", margin: "20px 0" }}>0</div>
                    </Radio.Button>
                    <Radio.Button
                      value="1"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      ☝<div style={{ fontSize: "20px", margin: "20px 0" }}>1</div>
                    </Radio.Button>
                    <Radio.Button
                      value="2"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      ✌<div style={{ fontSize: "20px", margin: "20px 0" }}>2</div>
                    </Radio.Button>
                    <Radio.Button
                      value="3"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      🤟<div style={{ fontSize: "20px", margin: "20px 0" }}>3</div>
                    </Radio.Button>
                    <Radio.Button
                      value="4"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      ✌✌<div style={{ fontSize: "20px", margin: "20px 0" }}>4</div>
                    </Radio.Button>
                    <Radio.Button
                      value="5"
                      style={{ height: "140px", width: "140px", fontSize: "40px", paddingTop: "32px" }}
                    >
                      🖐<div style={{ fontSize: "20px", margin: "20px 0" }}>5</div>
                    </Radio.Button>
                  </Radio.Group>
                  <div style={{ margin: 20 }}>
                    <label style={{ fontSize: 20, marginRight: 10 }}>Your total guess:</label>
                    <InputNumber
                      value={total}
                      min="0"
                      max="100"
                      step="1"
                      placeholder="Total"
                      disabled={true}
                    />
                  </div>
                  <div>
                    <Button type="primary" style={{ marginTop: 8 }} onClick={reveal}>
                      Reveal
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2>Time left</h2>
                  {timeLeft !== undefined && (
                    <>
                      <h2>{humanizeDuration(timeLeft * 1000)}</h2>
                      <h3>If the other players fails to reveal in time, you can finish this round</h3>
                    </>
                  )}
                  {timeLeft === 0 && (
                    <Button type="primary" style={{ marginTop: 8 }} onClick={finishRound}>
                      Finish Round
                    </Button>
                  )}
                </>
              )}
            </div>
          </>
        )}
        {currentUIState === UIState.ResultPhase && (
          <>
            <div style={{ margin: 8 }}>
              <h2>Game State</h2>
              <h1>{gameStateMessage}</h1>
            </div>
            <Divider />
            <div style={{ margin: 8 }}>
              <h3>Winners</h3>
              <Row>
                {winners && winners.map(function(player, i) {
                  return (
                    <Col
                      span={12}
                      style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
                    >
                      <Address address={player} ensProvider={mainnetProvider} fontSize={16} />
                    </Col>
                  )
                })}
              </Row>
            </div>
            <Divider />
            <Button style={{ marginTop: 8 }} size="large" onClick={leaveGame}>
              New Game 🔁
            </Button>
          </>
        )}
      </div>

      {/*
        📑 Maybe display a list of events?
          (uncomment the event and emit line in YourContract.sol! )
      */}
      {/* <Events
        contracts={readContracts}
        contractName="Morra"
        eventName="GameUpdate"
        localProvider={localProvider}
        mainnetProvider={mainnetProvider}
        startBlock={1}
      /> */}
    </div>
  );
}
