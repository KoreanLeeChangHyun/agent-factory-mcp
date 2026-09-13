class KnowledgeError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class KnowledgePermissionError(KnowledgeError):
    pass


class KnowledgeNotFoundError(KnowledgeError):
    pass


class KnowledgeConflictError(KnowledgeError):
    pass


class KnowledgeValidationError(KnowledgeError):
    pass


class KnowledgeProviderError(KnowledgeError):
    pass


class KnowledgeWriteRolledBackError(KnowledgeError):
    """The database confirmed that no authoritative mutation committed."""


class KnowledgeCommitUnknownError(KnowledgeError):
    """The database may have committed although acknowledgement was lost."""
