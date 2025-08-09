package com.suriname.repairpreset.controller;

import com.suriname.repairpreset.dto.PresetRequestDto;
import com.suriname.repairpreset.dto.PresetResponseDto;
import com.suriname.repairpreset.service.RepairPresetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/repair-presets")
@RequiredArgsConstructor
public class RepairPresetController {

    private final RepairPresetService repairPresetService;

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<Void> createPreset(@RequestBody PresetRequestDto requestDto) {
        repairPresetService.createPreset(requestDto);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping
    public ResponseEntity<List<PresetResponseDto>> getAllPresets(
            @RequestParam(value = "categoryId", required = false) Long categoryId
    )
    {
        List<PresetResponseDto> responseDtos = (categoryId == null)
                ? repairPresetService.getAllPresets()
                :repairPresetService.getPresetsByCategory(categoryId);

        return ResponseEntity.ok(responseDtos);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivatePreset(@PathVariable Long id) {
        repairPresetService.deactivatePreset(id);
        return ResponseEntity.noContent().build();
    }

    // 수리내역 작성용 - 인증 없이 접근 가능
    @GetMapping("/category/{categoryId}/active")
    public ResponseEntity<List<PresetResponseDto>> getActivePresetsByCategory(@PathVariable Long categoryId) {
        List<PresetResponseDto> presets = repairPresetService.getPresetsByCategory(categoryId);
        return ResponseEntity.ok(presets);
    }
}
