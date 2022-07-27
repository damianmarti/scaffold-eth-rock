pragma solidity >=0.8.0 <0.9.0;

//SPDX-License-Identifier: MIT

contract Morra {
    // 4 Game Phases: Join, Commit, Reveal, Result
    enum GameState {
        JoinPhase,
        CommitPhase,
        RevealPhase,
        ResultPhase
    }

    struct GamePlayerStruct {
        bool initialized;
        uint256 round;
        GameState gameState;
        uint256 playersCount;
        address creator;
        bool commited;
        bool revealed;
        uint256 commitsCount;
        uint256 revealsCount;
        uint256 points;
        address gameHash;
    }

    struct RoundStruct {
        uint256 commitsCount;
        mapping(address => bytes32) commits;
        uint256 revealsCount;
        mapping(address => bool) reveals;
        mapping(address => uint8) numbers;
        mapping(uint256 => address[]) totals;
        uint256 total;
    }

    // Holds the game data for a single match
    struct GameStruct {
        bool initialized;
        address[] playersArray;
        mapping(address => bool) players;
        uint256 playersCount;
        GameState gameState;
        uint256 round;
        uint256 revealDeadline;
        mapping(address => uint256) points;
        address creator;
        mapping(uint256 => RoundStruct) rounds;
    }

    // Maps Game address => Game data
    mapping(address => GameStruct) public games;
    // Maps Player address to their current 'active' game
    mapping(address => address) public activeGame;

    event GameCreated(address indexed gameHash, address indexed creator);
    event GameJoined(address indexed gameHash, address indexed player);
    event GameStarted(address indexed gameHash);
    event PlayerCommit(address indexed gameHash, address indexed player, uint256 indexed round, bytes32 commitHash);
    event PlayerReveal(address indexed gameHash, address indexed player, uint256 indexed round, uint8 number, uint256 total, string salt);
    event RoundWinner(address indexed gameHash, address indexed player, uint256 indexed round);
    event RoundEnd(address indexed gameHash, uint256 indexed round);
    event CommitEnd(address indexed gameHash, uint256 indexed round);
    event GameEnd(address indexed gameHash);

    /**
     * @notice Modifier that checks game is initialized, the sender is among players
     * and that the game state to be in the expected phase
     * @param gameHash - the game code
     * @param gameState - the three possible game phases
     */
    modifier validGameState(address gameHash, GameState gameState) {
        // Check that the game exists
        require(
            games[gameHash].initialized == true,
            "Game code does not exist"
        );
        // Check player is among players
        require(
            games[gameHash].players[msg.sender],
            "Player not in this game"
        );
        // Check that game is in expected state
        require(
            games[gameHash].gameState == gameState,
            "Game not in correct phase"
        );
        _;
    }

    /**
     * @notice Creates a new game, generating a game hash and setting the sender as player
     */
    function createGame() public returns (address) {
        //
        address gameHash = generateGameHash();
        require(
            !games[gameHash].initialized,
            "Game code already exists, please try again"
        );

        games[gameHash].initialized = true;
        games[gameHash].players[msg.sender] = true;
        games[gameHash].playersArray.push(msg.sender);
        games[gameHash].playersCount = 1;
        games[gameHash].creator = msg.sender;

        // Set game phase to initial join phase
        games[gameHash].gameState = GameState.JoinPhase;

        // Set P1 active game to game hash
        activeGame[msg.sender] = gameHash;

        emit GameCreated(gameHash, msg.sender);

        // Return the game hash so it can be shared
        return gameHash;
    }

    /**
     * @notice Function for other players to join a game with the game address
     * @param gameHash - game address shared by game creator
     */
    function joinGame(address gameHash)
        public
    {
        // Check that the game exists
        require(
            games[gameHash].initialized == true,
            "Game code does not exist"
        );
        // Check player is not among players
        require(
            !games[gameHash].players[msg.sender],
            "Player already in this game"
        );
        // Check that game is in expected state
        require(
            games[gameHash].gameState == GameState.JoinPhase,
            "Game not in correct phase"
        );

        games[gameHash].players[msg.sender] = true;
        games[gameHash].playersArray.push(msg.sender);
        games[gameHash].playersCount++;

        // Set player active game to game hash
        activeGame[msg.sender] = gameHash;

        emit GameJoined(gameHash, msg.sender);
    }

    /**
     * @notice Function to start a game by the creator
     * @param gameHash - game address
     */
    function startGame(address gameHash)
        public
        validGameState(gameHash, GameState.JoinPhase)
    {
        require(games[gameHash].creator == msg.sender, "Only the creator can start the game");

        // Set game phase to commit phase
        games[gameHash].gameState = GameState.CommitPhase;

        games[gameHash].round = 1;

        emit GameStarted(gameHash);
    }

    /**
     * @notice Function for players to commit their choice
     * @dev players can commit multiple times to change their choice until the other player commits
     * @param commitHash Commit hash (choice + salt)
     */
    function commit(bytes32 commitHash)
        public
        validGameState(activeGame[msg.sender], GameState.CommitPhase)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[msg.sender];

        if (games[gameHash].rounds[games[gameHash].round].commits[msg.sender] == bytes32(0)) {
            games[gameHash].rounds[games[gameHash].round].commitsCount++;
        }

        games[gameHash].rounds[games[gameHash].round].commits[msg.sender] = commitHash;

        emit PlayerCommit(gameHash, msg.sender, games[gameHash].round, commitHash);

        // If all players have committed, set game state to reveal phase
        if (games[gameHash].rounds[games[gameHash].round].commitsCount == games[gameHash].playersCount) {
            games[gameHash].gameState = GameState.RevealPhase;
            emit CommitEnd(gameHash, games[gameHash].round);
        }
    }

    /**
     * @notice Function for players to reveal their choice. The first player to reveal sets a deadline for the second player
     * this is prevent players for abandoning the game once they know they have lost based on the revealed hash.
     * At the end of the deadline, anyone can trigger a "win-by-default".
     * If all players reveal in time, the last player's reveal will call determineWinner() and advance the game to the result phase
     * @notice Unlike commit, players can only reveal once
     * @param number - the selected number (0 to 5)
     * @param total - the selected total number (0 to number of players * 5)
     * @param salt - a player chosen secret string from the "commit" phase used to prove their choice via a hash match
     */
    function reveal(uint8 number, uint256 total, string memory salt)
        public
        validGameState(activeGame[msg.sender], GameState.RevealPhase)
    {
        require(number <= 5, "Invalid number. Number must be between 0 and 5.");

        // Get the game hash from active game mapping
        address gameHash = activeGame[msg.sender];

        require(total <= 5 * games[gameHash].playersCount, "Wrong total");

        require(!games[gameHash].rounds[games[gameHash].round].reveals[msg.sender], "Already revealed");

        // Verify that one of the choices + salt hashes matches commit hash
        // Compare all three possible choices so they don't have to enter their choice again
        bytes32 verificationHash = keccak256(
            abi.encodePacked(number, total, salt)
        );

        uint256 currentRound = games[gameHash].round;

        require(
            verificationHash == games[gameHash].rounds[currentRound].commits[msg.sender],
            "Verification hash doesn't match commit hash. Salt and/or choice not the same as commit."
        );

        // Save the revealed number and total
        games[gameHash].rounds[currentRound].numbers[msg.sender] = number;
        games[gameHash].rounds[currentRound].totals[total].push(msg.sender);

        games[gameHash].rounds[currentRound].total += number;

        games[gameHash].rounds[currentRound].reveals[msg.sender] = true;
        games[gameHash].rounds[currentRound].revealsCount++;

        emit PlayerReveal(gameHash, msg.sender, currentRound, number, total, salt);

        // if all players revealed, determine winner
        if (games[gameHash].rounds[currentRound].revealsCount == games[gameHash].playersCount) {
            _determineWinners(gameHash);
        }

        if (games[gameHash].rounds[currentRound].revealsCount == 1) {
            // Set deadline for other players to reveal
            games[gameHash].revealDeadline = block.timestamp + 3 minutes;
        }
    }

    /**
     * @notice Players can this to leave the game at anytime. Usually at the end to reset the UI
     */
    function leaveGame() public {
        activeGame[msg.sender] = address(0);
    }

    /// @notice Util Functions for generating hashes, computing winners and fetching data

    function generateGameHash() public view returns (address) {
        bytes32 prevHash = blockhash(block.number - 1);
        // Game hash is a pseudo-randomly generated address from last blockhash + p1
        return
            address(bytes20(keccak256(abi.encodePacked(prevHash, msg.sender))));
    }

    /**
     * @notice Determine the winners
     * @param gameHash - gameHash to determine winners
     */
    function _determineWinners(address gameHash)
        internal
    {
        RoundStruct storage currentRound = games[gameHash].rounds[games[gameHash].round];

        emit RoundEnd(gameHash, games[gameHash].round);

        bool finish = false;

        for (uint i = 0; i < currentRound.totals[currentRound.total].length; i++) {
            games[gameHash].points[currentRound.totals[currentRound.total][i]]++;

            emit RoundWinner(gameHash, currentRound.totals[currentRound.total][i], games[gameHash].round);

            if (games[gameHash].points[currentRound.totals[currentRound.total][i]] == 3) {
                finish = true;
            }
        }

        if (games[gameHash].round == 10) {
            finish = true;
        }

        if (finish) {
            games[gameHash].gameState = GameState.ResultPhase;

            emit GameEnd(gameHash);
        } else {
            games[gameHash].round++;
            games[gameHash].gameState = GameState.CommitPhase;
        }
    }

    /**
     * @notice Determine the winners after reveal timeout
     * @param gameHash - gameHash to determine winners
     */
    function determineWinnersAfterRevealTimeout(address gameHash)
        public
    {
        // Check that the game exists
        require(
            games[gameHash].initialized == true,
            "Game code does not exist"
        );
        // Check that game is in expected state
        require(
            games[gameHash].gameState == GameState.RevealPhase,
            "Game not in reveal phase"
        );
        // Check that we are after the reveal deadline
        require(
            block.timestamp < games[gameHash].revealDeadline,
            "Reveal deadline not reached"
        );

        _determineWinners(gameHash);
    }

    function getPlayersOnGame(address gameHash)
        public
        view
        returns (address[] memory)
    {
                // Check that the game exists
        require(
            games[gameHash].initialized == true,
            "Game code does not exist"
        );

        return games[gameHash].playersArray;
    }

    /**
     * @notice Fetches the game data of the player's active game
     * @param player - address of player
     */
    function getActiveGameData(address player)
        public
        view
        returns (GamePlayerStruct memory)
    {
        // Get the game hash from active game mapping
        address gameHash = activeGame[player];

        GamePlayerStruct memory gameData;

        uint256 currentRoundNumber = games[gameHash].round;

        gameData.initialized = games[gameHash].initialized;
        gameData.round = currentRoundNumber;
        gameData.gameState = games[gameHash].gameState;
        gameData.playersCount = games[gameHash].playersCount;
        gameData.creator = games[gameHash].creator;
        gameData.commited = games[gameHash].rounds[currentRoundNumber].commits[player] != bytes32(0);
        gameData.revealed = games[gameHash].rounds[currentRoundNumber].reveals[player];
        gameData.commitsCount = games[gameHash].rounds[currentRoundNumber].commitsCount;
        gameData.revealsCount = games[gameHash].rounds[currentRoundNumber].revealsCount;
        gameData.points = games[gameHash].points[player];
        gameData.gameHash = gameHash;

        return gameData;
    }
}
