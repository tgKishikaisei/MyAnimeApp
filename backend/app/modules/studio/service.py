"""
Сервисный слой мини-студии (Studio).
Представляет собой обертку (Wrapper) над утилитой FFmpeg.
Позволяет фильтровать видео, менять формат, интерполировать кадры (60 FPS), 
накладывать мемы (текст) и извлекать аудиодорожки в асинхронном режиме.
"""
import os
import ffmpeg
import asyncio

from app.core.logger import get_logger

logger = get_logger(__name__)

# Шрифт для мем-текста: Windows (dev) или Debian (Docker, пакет fonts-dejavu-core).
_FONT_CANDIDATES = (
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)

def generate_ffmpeg_command(
    input_filepath: str,
    output_filepath: str,
    start_time: float,
    duration: float,
    format: str,
    quality: str,
    fps: int,
    speed: float,
    audio_effect: str,
    add_text: str = None
):
    """
    Создает сложный граф фильтров FFmpeg и запускает рендер видеоклипа.
    Функция выполняется синхронно (поэтому её вызывают через asyncio.to_thread).
    """
    # Загружаем видео и обрезаем его по времени (start_time -> t=duration)
    input_stream = ffmpeg.input(input_filepath, ss=start_time, t=duration)
    video = input_stream.video
    audio = input_stream.audio
    
    # --- 1. Разрешение и Обрезка кадра ---
    if format == "mobile":
        # Вертикальное видео: обрезаем кадр по центру пропорцией 9:16 (стиль TikTok/Shorts)
        video = video.filter('crop', 'ih*9/16', 'ih')
        if quality == "upscale":
            # Апскейл до 1080x1920 с качественным алгоритмом lanczos
            video = video.filter('scale', 1080, 1920, flags='lanczos')
        else:
            video = video.filter('scale', 720, 1280)
    elif format == "gif":
        # Для GIF жестко фиксируем ширину 480px, чтобы не весила слишком много
        video = video.filter('scale', 480, -1)
    else:
        # Для обычных экранов (Десктоп) апскейл до Full HD
        if quality == "upscale":
            video = video.filter('scale', 1920, 1080, flags='lanczos')
            
    # --- 2. Интерполяция кадров (Плавность) ---
    if fps == 60:
        # Искусственно дорисовываем кадры между существующими (из 24fps в 60fps)
        video = video.filter('minterpolate', fps=60, mi_mode='mci')
        
    # --- 3. Контроль скорости ---
    if speed != 1.0:
        # Ускорение/Замедление видео и соответствующая подгонка аудио питча
        video = video.filter('setpts', f"{1.0/speed}*PTS")
        audio = audio.filter('atempo', speed)
        
    # --- 4. Аудио-эффекты ---
    if audio_effect == "normalize":
        audio = audio.filter('loudnorm') # Нормализация (выравнивание) громкости
    elif audio_effect == "bass_boost":
        audio = audio.filter('bass', g=15, f=110) # Усиление басов (Мемный эффект)
    
    # --- 5. Генерация GIF палитры ---
    if format == "gif":
        # Чтобы GIF не выглядела "пиксельно-кислотной", мы сначала генерируем 
        # оптимальную палитру цветов из первой половины видео, а затем применяем её ко второй
        split = video.split()
        stream1 = split.stream(0)
        stream2 = split.stream(1)
        palette = stream1.filter('palettegen', stats_mode='diff')
        video = ffmpeg.filter([stream2, palette], 'paletteuse', dither='bayer')
        
    # --- 6. Наложение текста (Мем-генератор) ---
    if add_text:
        # ffmpeg-python сам экранирует аргументы фильтра. expansion='none'
        # отключает подстановки вида %{...} в пользовательском тексте.
        font_path = next((p for p in _FONT_CANDIDATES if os.path.exists(p)), None)
        drawtext_kwargs = dict(
            text=add_text, expansion='none', fontcolor='white', fontsize=48,
            x='(w-text_w)/2', y='(h-text_h)-20',
            shadowcolor='black', shadowx=2, shadowy=2,
        )
        if font_path:
            drawtext_kwargs["fontfile"] = font_path
        video = video.drawtext(**drawtext_kwargs)
    
    # --- 7. Сборка и Рендер ---
    if format == "gif":
        # У GIF нет аудиодорожки
        out_stream = ffmpeg.output(video, output_filepath)
    else:
        # А стандартное видео жмем кодеком H.264 (чтобы читалось везде) и AAC для аудио
        out_stream = ffmpeg.output(video, audio, output_filepath, acodec='aac', vcodec='libx264')
    
    # Запускаем системный процесс
    ffmpeg.run(out_stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)

def generate_mp3_command(input_filepath: str, output_filepath: str):
    """
    Отдельная фича: Вытаскивает только звуковую дорожку из видеоклипа и сохраняет как MP3.
    Использует популярный музыкальный кодек libmp3lame (192 kbps).
    """
    stream = ffmpeg.input(input_filepath)
    audio = stream.audio
    out_stream = ffmpeg.output(audio, output_filepath, acodec='libmp3lame', audio_bitrate='192k')
    
    ffmpeg.run(out_stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)

# --- АСИНХРОННЫЕ ОБЕРТКИ ---
# FFmpeg - это блокирующая систему программа. Если её просто запустить в FastAPI,
# сервер повиснет и не сможет отвечать другим пользователям, пока видео не отрендерится.
# Поэтому мы запихиваем FFmpeg в отдельный системный поток с помощью asyncio.to_thread

async def process_video_async(*args, **kwargs):
    """Запускает рендер видео (FFmpeg) в безопасном фоновом потоке"""
    return await asyncio.to_thread(generate_ffmpeg_command, *args, **kwargs)

async def extract_audio_async(*args, **kwargs):
    """Запускает экспорт MP3 в фоновом потоке"""
    return await asyncio.to_thread(generate_mp3_command, *args, **kwargs)
