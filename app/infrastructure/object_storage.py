"""S3-compatible object storage boundary."""

from __future__ import annotations

from asyncio import to_thread
from typing import Protocol

import boto3
from botocore.client import BaseClient

from app.core.config import Settings


class ObjectStorage(Protocol):
    async def put(self, key: str, content: bytes, media_type: str) -> None: ...

    async def get(self, key: str) -> bytes: ...

    async def delete(self, key: str) -> None: ...


class S3ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_bucket
        self.client: BaseClient = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )

    async def put(self, key: str, content: bytes, media_type: str) -> None:
        await to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=media_type,
        )

    async def get(self, key: str) -> bytes:
        response = await to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        return await to_thread(response["Body"].read)

    async def delete(self, key: str) -> None:
        await to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)
