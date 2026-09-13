"""Knowledge application services shared by HTTP and MCP delivery."""

from dataclasses import dataclass

from .cloud import CloudKnowledgeUseCases
from .delivery import DocumentDeliveryUseCases
from .package_queries import DocumentPackageQueries
from .use_cases import DocumentUseCases, SearchUseCases


@dataclass(frozen=True, slots=True)
class KnowledgeService:
    documents: DocumentUseCases
    search: SearchUseCases


@dataclass(frozen=True, slots=True)
class CloudService:
    cloud: CloudKnowledgeUseCases
    delivery: DocumentDeliveryUseCases
    packages: DocumentPackageQueries
