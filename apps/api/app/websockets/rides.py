from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws/rides/{ride_id}")
async def ride_updates(websocket: WebSocket, ride_id: str):
    await websocket.accept()
    await websocket.send_json({"ride_id": ride_id, "status": "connected"})
    await websocket.close()

