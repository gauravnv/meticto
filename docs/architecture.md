# Meticto Architecture

This diagram illustrates the high-level architecture of the Meticto application, showing the relationship between the client, server, and key components involved in real-time communication and game logic.

```mermaid
graph TD
    subgraph Client Browser
        direction LR
        U["User Interface (React Components)"]
    end

    subgraph Client React App
        direction LR
        Ctx["SocketContext / useSocketContext"]
        SockSvc["socketService (Socket.IO Client)"]
    end

    subgraph Server Node.js / Express
        direction LR
        SIOServer["Socket.IO Server Instance"]
        GM["GameManager"]
        State["(In-Memory Game State)"]
    end

    %% Client Internal Flow
    U -- "User Actions (Click, Input)" --> Ctx
    Ctx -- "Emits Events (e.g., ATTEMPT_MOVE)" --> SockSvc
    SockSvc -- "Receives Broadcasts (e.g., GAME_STATE_UPDATE)" --> Ctx
    Ctx -- "Updates State" --> U

    %% Server Internal Flow
    SIOServer -- "Receives Events" --> GM
    GM -- "Reads/Updates" --> State
    GM -- "Determines Broadcasts" --> SIOServer

    %% Client <-> Server Communication
    SockSvc -- "WebSockets" --> SIOServer
