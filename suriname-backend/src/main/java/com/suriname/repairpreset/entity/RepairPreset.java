package com.suriname.repairpreset.entity;

import com.suriname.category.entity.Category;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "repair_preset",
        uniqueConstraints = @UniqueConstraint(name="uq_repair_preset_category_name",
                columnNames={"category_id","name"}),
        indexes = @Index(name="idx_repair_preset_category", columnList="category_id"))
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Getter
public class RepairPreset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "repair_presets_id")
    private Long repairPresetsId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private Integer cost;

    @Column(nullable = false)
    private Boolean isActive = true;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (isActive == null)  isActive = true;
    }

    @Builder
    public RepairPreset(Category category, String name, Integer cost) {
        this.category = category;
        this.name = name;
        this.cost = cost;
        this.isActive = true;
    }

    public void inactive() {
        this.isActive = false;
    }
}
