from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ClipProcessRequest(BaseModel):
    """
    Параметры рендера. Все значения ограничены: `speed=0` дал бы деление
    на ноль, а произвольная строка попала бы в граф фильтров FFmpeg.
    """
    model_config = ConfigDict(extra="forbid")

    start_time: float = Field(..., ge=0, le=6 * 3600)
    end_time: float = Field(..., gt=0, le=6 * 3600)
    format: Literal["mp4", "gif", "mobile"] = "mp4"
    quality: Literal["standard", "upscale"] = "standard"
    fps: Literal[24, 30, 60] = 24
    speed: float = Field(1.0, ge=0.5, le=2.0)  # диапазон фильтра atempo
    audio_effect: Literal["none", "normalize", "bass_boost"] = "none"
    add_text: Optional[str] = Field(None, max_length=80)

    @model_validator(mode="after")
    def _check_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time должен быть больше start_time")
        if self.end_time - self.start_time > 15:
            raise ValueError("Максимальная длина фрагмента — 15 секунд")
        return self
