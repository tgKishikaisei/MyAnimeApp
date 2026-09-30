"""
Celery задачи для Studio (FFmpeg обработка видео).
Запуск: celery -A app.core.celery_app worker --loglevel=info
"""
import os
import uuid
import tempfile
from app.core.celery_app import celery_app


@celery_app.task(bind=True, name="studio.process_video")
def process_video_task(
    self,
    input_filepath: str,
    start_time: float,
    duration: float,
    format: str = "mp4",
    quality: str = "default",
    fps: int = 24,
    speed: float = 1.0,
    audio_effect: str = "none",
    add_text: str = None,
    clip_title: str = "clip",
):
    """
    Celery задача для обработки видео через FFmpeg.
    Возвращает путь к результирующему файлу.
    """
    from app.modules.studio.service import generate_ffmpeg_command
    
    # Обновляем статус
    self.update_state(state='PROCESSING', meta={'progress': 10})
    
    temp_dir = tempfile.gettempdir()
    file_extension = "mp4" if format == "mobile" else format
    output_filename = f"studio_{uuid.uuid4().hex[:8]}.{file_extension}"
    output_filepath = os.path.join(temp_dir, output_filename)
    
    try:
        self.update_state(state='PROCESSING', meta={'progress': 30})
        
        generate_ffmpeg_command(
            input_filepath=input_filepath,
            output_filepath=output_filepath,
            start_time=start_time,
            duration=duration,
            format=format,
            quality=quality,
            fps=fps,
            speed=speed,
            audio_effect=audio_effect,
            add_text=add_text,
        )
        
        if not os.path.exists(output_filepath):
            raise Exception("FFmpeg failed to generate the output file.")
        
        self.update_state(state='PROCESSING', meta={'progress': 100})
        
        return {
            "status": "completed",
            "output_filepath": output_filepath,
            "filename": f"MyAnimeClip_{clip_title}_{start_time}-{start_time + duration}.{file_extension}",
            "media_type": "image/gif" if format == "gif" else "video/mp4",
        }
        
    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise
