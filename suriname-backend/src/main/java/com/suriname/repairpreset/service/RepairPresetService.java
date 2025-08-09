package com.suriname.repairpreset.service;

import com.suriname.category.entity.Category;
import com.suriname.category.repository.CategoryRepository;
import com.suriname.repairpreset.dto.PresetRequestDto;
import com.suriname.repairpreset.dto.PresetResponseDto;
import com.suriname.repairpreset.entity.RepairPreset;
import com.suriname.repairpreset.repository.RepairPresetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RepairPresetService {

    private final RepairPresetRepository repairPresetRepository;
    private final CategoryRepository categoryRepository;

    @Transactional
    public void createPreset(PresetRequestDto requestDto) {
        final Long categoryId = requestDto.getCategoryId();
        final String name = requestDto.getName() == null ? "" : requestDto.getName().trim();

        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "프리셋 이름을 입력해주세요.");
        }

        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "카테고리를 찾을 수 없습니다."));

        boolean duplicated = repairPresetRepository
                .existsByCategory_CategoryIdAndNameIgnoreCase(categoryId, name);
        if (duplicated) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "중복된 프리셋입니다.");
        }

        RepairPreset preset = RepairPreset.builder()
                .category(category)
                .name(name)
                .cost(requestDto.getCost())
                .build();

        try {
            repairPresetRepository.save(preset);
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "중복된 프리셋입니다.");
        }
    }

    @Transactional(readOnly = true)
    public List<PresetResponseDto> getAllPresets() {
        return repairPresetRepository.findByIsActiveTrue().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PresetResponseDto> getPresetsByCategory(Long categoryId) {
        return repairPresetRepository.findByCategory_CategoryIdAndIsActiveTrue(categoryId).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deactivatePreset(Long id) {
        RepairPreset preset = repairPresetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("프리셋을 찾을 수 없습니다."));
        preset.inactive();
    }

    @Transactional(readOnly = true)
    public List<PresetResponseDto> getActivePresetsByCategory(Long categoryId) {
        return repairPresetRepository
                .findByCategory_CategoryIdAndIsActiveTrueOrderByNameAsc(categoryId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private PresetResponseDto toDto(RepairPreset preset) {
        return new PresetResponseDto(
                preset.getRepairPresetsId(),
                preset.getCategory().getCategoryId(),
                preset.getName(),
                preset.getCost(),
                preset.getIsActive(),
                preset.getCreatedAt().toLocalDate()
        );
    }
}
