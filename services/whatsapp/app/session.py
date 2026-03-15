from neonize import Session


class SessionManager:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self.session = None

    def get_session(self) -> Session:
        if self.session is None:
            self.session = Session(storage_path=self.storage_path)
        return self.session

    def is_connected(self) -> bool:
        return self.session is not None and self.session.is_connected
