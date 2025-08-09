package com.suriname.repairpreset.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class PresetRequestDto {
    private Long categoryId;
    private String name;
    private String description;
    private Integer cost;
}
