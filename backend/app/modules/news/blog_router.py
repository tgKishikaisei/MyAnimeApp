from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.modules.anime import schemas, models

router = APIRouter()

@router.get("/", response_model=List[schemas.BlogPost])
async def get_blog_posts(skip: int = 0, limit: int = 10, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    query = select(models.BlogPost).offset(skip).limit(limit).order_by(models.BlogPost.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{post_id}", response_model=schemas.BlogPost)
async def get_blog_post(post_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from fastapi import HTTPException
    result = await db.execute(select(models.BlogPost).where(models.BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return post

from app.api.deps import get_current_active_superuser

@router.post("/", response_model=schemas.BlogPost)
async def create_blog_post(
    post_in: schemas.BlogPostCreate, 
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_superuser)
):
    db_obj = models.BlogPost(**post_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/{post_id}", status_code=204)
async def delete_blog_post(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_superuser)
):
    from sqlalchemy import select
    result = await db.execute(select(models.BlogPost).where(models.BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
         from fastapi import HTTPException
         raise HTTPException(status_code=404, detail="Blog post not found")
    
    await db.delete(post)
    await db.commit()
    return None

@router.put("/{post_id}", response_model=schemas.BlogPost)
async def update_blog_post(
    post_id: int,
    post_in: schemas.BlogPostUpdate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_active_superuser)
):
    from sqlalchemy import select
    from fastapi import HTTPException
    result = await db.execute(select(models.BlogPost).where(models.BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")
    
    update_data = post_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(post, field, value)
        
    await db.commit()
    await db.refresh(post)
    return post
